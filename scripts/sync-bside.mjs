#!/usr/bin/env node
/**
 * Builds the encrypted song payload for the /b-side guessing game.
 *
 *   npm run sync:bside
 *
 * Reads a Spotify playlist with the client-credentials flow, resolves a ~30s
 * audio preview for every track, and writes the result to
 * public/b-side/songs.enc.json encrypted with AES-256-GCM under a key derived
 * from the game password.
 *
 * Your client secret is only ever used here, on your machine. Nothing secret is
 * written into the site bundle.
 *
 * Configuration comes from environment variables, or from a gitignored
 * scripts/bside.local.json of the same shape:
 *
 *   {
 *     "clientId":     "…",   // SPOTIFY_CLIENT_ID
 *     "clientSecret": "…",   // SPOTIFY_CLIENT_SECRET
 *     "playlist":     "…",   // BSIDE_PLAYLIST  (url, uri, or bare id)
 *     "password":     "…",   // BSIDE_PASSWORD  (default: 12345678)
 *     "market":       "US"   // BSIDE_MARKET
 *   }
 *
 * Flags:
 *   --dry   Fetch and match, print the report, write nothing.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'public', 'b-side', 'songs.enc.json');
const LOCAL_CONFIG = path.join(ROOT, 'scripts', 'bside.local.json');

const PBKDF2_ITERATIONS = 310_000;
const ITUNES_THROTTLE_MS = 350;
const DRY_RUN = process.argv.includes('--dry');

// ---------------------------------------------------------------- pretty log

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function fail(message, hint) {
  console.error(`\n${c.red('✗')} ${message}`);
  if (hint) console.error(`${c.dim('  ' + hint)}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------- config

async function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(await fs.readFile(LOCAL_CONFIG, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') fail(`Could not parse ${path.relative(ROOT, LOCAL_CONFIG)}: ${err.message}`);
  }

  const config = {
    clientId: process.env.SPOTIFY_CLIENT_ID || file.clientId,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || file.clientSecret,
    playlist: process.env.BSIDE_PLAYLIST || file.playlist,
    password: process.env.BSIDE_PASSWORD || file.password || '12345678',
    market: process.env.BSIDE_MARKET || file.market || 'US',
  };

  const missing = ['clientId', 'clientSecret', 'playlist'].filter((k) => !config[k]);
  if (missing.length) {
    fail(
      `Missing config: ${missing.join(', ')}`,
      `Set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / BSIDE_PLAYLIST, or create scripts/bside.local.json.\n  ` +
        `Credentials come from https://developer.spotify.com/dashboard (create an app, then "Settings").`,
    );
  }
  return config;
}

/** Accepts a playlist URL, a spotify: URI, or a bare id. */
function parsePlaylistId(input) {
  const trimmed = String(input).trim();
  const url = trimmed.match(/playlist[/:]([A-Za-z0-9]+)/);
  const id = url ? url[1] : trimmed;
  if (!/^[A-Za-z0-9]{16,}$/.test(id)) {
    fail(`"${trimmed}" doesn't look like a Spotify playlist.`, 'Paste the "Copy link to playlist" URL.');
  }
  return id;
}

// ------------------------------------------------------------------ spotify

async function getAccessToken({ clientId, clientSecret }) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const body = await res.text();
    fail(
      `Spotify rejected the credentials (HTTP ${res.status}).`,
      res.status === 400 || res.status === 401
        ? `Check the client ID and secret. Response: ${body.slice(0, 200)}`
        : body.slice(0, 200),
    );
  }
  return (await res.json()).access_token;
}

async function spotifyGet(url, token) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const wait = (Number(res.headers.get('retry-after')) || 2) * 1000;
      console.log(c.dim(`  rate limited, waiting ${wait / 1000}s…`));
      await sleep(wait);
      continue;
    }
    if (res.status === 404) {
      fail(
        'Spotify returned 404 for that playlist.',
        'A playlist is only readable this way if it is public. Open it in Spotify → ⋯ → Share → make sure it is public, ' +
          'or use a playlist you own that is set to public.',
      );
    }
    if (!res.ok) fail(`Spotify request failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  fail('Spotify kept rate limiting the request. Try again in a minute.');
  return null;
}

async function fetchPlaylist(playlistId, token, market) {
  const meta = await spotifyGet(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,external_urls(spotify),owner(display_name)&market=${market}`,
    token,
  );

  const fields = encodeURIComponent(
    'items(track(id,name,duration_ms,preview_url,external_urls(spotify),artists(name),album(name,release_date,images))),next',
  );
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=${market}&fields=${fields}`;
  const tracks = [];

  while (url) {
    const page = await spotifyGet(url, token);
    for (const item of page.items ?? []) {
      const t = item?.track;
      if (!t?.id || !t.name) continue; // local files, removed tracks, podcast episodes
      const images = t.album?.images ?? [];
      tracks.push({
        id: t.id,
        title: t.name,
        artists: (t.artists ?? []).map((a) => a.name).filter(Boolean),
        album: t.album?.name ?? '',
        year: (t.album?.release_date ?? '').slice(0, 4),
        art: images[0]?.url ?? '',
        artSmall: (images[images.length - 1] ?? images[0])?.url ?? '',
        url: t.external_urls?.spotify ?? '',
        durationMs: t.duration_ms ?? 0,
        preview: t.preview_url ?? null,
        previewSource: t.preview_url ? 'spotify' : null,
      });
    }
    url = page.next;
  }

  // A playlist can hold the same track twice; the game only wants it once.
  const seen = new Set();
  const unique = tracks.filter((t) => !seen.has(t.id) && seen.add(t.id));
  return { meta, tracks: unique };
}

// -------------------------------------------------------------- itunes match

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strips the noise that keeps the same song from matching across catalogues. */
function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(feat\.?[^)]*\)|\[feat\.?[^\]]*\]|\bfeat\.?\s.+$/g, ' ')
    .replace(/\s[-–—]\s.*(remaster|version|edit|mix|radio|mono|stereo|deluxe|live|bonus).*$/g, ' ')
    .replace(/\((remaster|remastered|deluxe|bonus|explicit)[^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return 0.85;
  if (a.includes(b) || b.includes(a)) return 0.7;
  return 0;
}

function artistScore(spotifyArtists, itunesArtist) {
  const theirs = new Set(normalize(itunesArtist).split(' ').filter(Boolean));
  if (!theirs.size) return 0;
  let best = 0;
  for (const name of spotifyArtists) {
    const mine = normalize(name).split(' ').filter(Boolean);
    if (!mine.length) continue;
    const hits = mine.filter((word) => theirs.has(word)).length;
    best = Math.max(best, hits / mine.length);
  }
  return best;
}

async function findItunesPreview(track) {
  const term = `${track.artists[0] ?? ''} ${track.title}`.trim();
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&entity=song&limit=10&country=US`;

  let results = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': 'b-side-sync/1.0' } });
    if (res.status === 403 || res.status === 429) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    // The endpoint sometimes replies with text/javascript, so parse by hand.
    try {
      results = JSON.parse(await res.text()).results ?? [];
    } catch {
      return null;
    }
    break;
  }

  const wantTitle = normalize(track.title);
  let best = null;

  for (const r of results) {
    if (!r.previewUrl) continue;
    const score = titleScore(wantTitle, normalize(r.trackName)) * 0.65 + artistScore(track.artists, r.artistName) * 0.35;
    if (score > (best?.score ?? 0)) best = { score, previewUrl: r.previewUrl };
  }

  return best && best.score >= 0.6 ? best.previewUrl : null;
}

// ---------------------------------------------------------------- encryption

function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: salt.toString('base64') },
    cipher: { name: 'AES-GCM', iv: iv.toString('base64'), tagLength: 128 },
    // WebCrypto expects the GCM tag appended to the ciphertext.
    data: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString('base64'),
  };
}

// --------------------------------------------------------------------- main

async function main() {
  const config = await loadConfig();
  const playlistId = parsePlaylistId(config.playlist);

  console.log(`\n${c.bold('b-side')} ${c.dim('· building the song payload')}\n`);
  console.log(`${c.dim('playlist')}  ${playlistId}`);

  const token = await getAccessToken(config);
  const { meta, tracks } = await fetchPlaylist(playlistId, token, config.market);

  console.log(`${c.dim('name')}      ${meta.name}`);
  console.log(`${c.dim('tracks')}    ${tracks.length}\n`);
  if (!tracks.length) fail('That playlist has no playable tracks.');

  const needsPreview = tracks.filter((t) => !t.preview);
  if (needsPreview.length) {
    console.log(c.dim(`Resolving previews for ${needsPreview.length} track(s) via the iTunes catalogue…\n`));
  }

  for (const [index, track] of needsPreview.entries()) {
    const label = `${track.artists[0] ?? '?'} — ${track.title}`;
    process.stdout.write(`  ${String(index + 1).padStart(3)}/${needsPreview.length}  ${label.slice(0, 58).padEnd(58)}`);
    const preview = await findItunesPreview(track);
    if (preview) {
      track.preview = preview;
      track.previewSource = 'itunes';
      console.log(c.green('✓'));
    } else {
      console.log(c.yellow('no preview'));
    }
    if (index < needsPreview.length - 1) await sleep(ITUNES_THROTTLE_MS);
  }

  const playable = tracks.filter((t) => t.preview);
  const silent = tracks.filter((t) => !t.preview);

  console.log(
    `\n${c.bold('Result')}  ${c.green(`${playable.length} playable`)}` +
      (silent.length ? `  ${c.yellow(`${silent.length} without audio`)}` : ''),
  );
  if (silent.length) {
    console.log(c.dim('  These stay in the guess list as decoys but are never the answer:'));
    for (const t of silent) console.log(c.dim(`    · ${t.artists.join(', ')} — ${t.title}`));
  }
  if (!playable.length) fail('No track ended up with playable audio, so there is nothing to guess.');

  const payload = {
    generatedAt: new Date().toISOString(),
    playlist: { id: playlistId, name: meta.name ?? '', url: meta.external_urls?.spotify ?? '' },
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artists: t.artists,
      album: t.album,
      year: t.year,
      art: t.art,
      artSmall: t.artSmall,
      url: t.url,
      preview: t.preview,
      source: t.previewSource,
    })),
  };

  if (DRY_RUN) {
    console.log(`\n${c.cyan('Dry run')} ${c.dim('— nothing written.')}\n`);
    return;
  }

  const envelope = encrypt(JSON.stringify(payload), config.password);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(envelope)}\n`, 'utf8');

  const kb = (Buffer.byteLength(JSON.stringify(envelope)) / 1024).toFixed(1);
  console.log(`\n${c.green('✓')} Wrote ${c.bold(path.relative(ROOT, OUT_FILE))} ${c.dim(`(${kb} KB, encrypted)`)}`);
  console.log(c.dim(`  Commit that file and push to publish the update.\n`));
}

main().catch((err) => fail(err?.stack ?? String(err)));
