# B-Side

A Heardle-style guessing game built from a Spotify playlist, living at
`/b-side`. It is deliberately not in the site nav and not in any sitemap — the
only way in is the URL plus a password.

## How it fits together

GitHub Pages is static hosting, so there is nowhere to keep a Spotify secret at
runtime. The work is split in two:

- **`scripts/sync-bside.mjs`** runs on your machine. It reads the playlist with
  your Spotify credentials, finds a ~30s audio preview for each track, and
  writes `public/b-side/songs.enc.json` — encrypted.
- **`src/pages/BSide/`** is the page. It fetches that one file, asks for the
  password, decrypts in the browser, and plays.

Nothing secret ships in the bundle. The playlist is a snapshot: re-run the sync
whenever you change the playlist.

## First-time setup

1. Go to <https://developer.spotify.com/dashboard>, create an app (any name, any
   redirect URI — the client-credentials flow never uses it), and open its
   **Settings** to copy the Client ID and Client Secret.

2. Make the playlist public. The client-credentials flow can only read public
   playlists; a private one returns 404.

3. Copy the example config and fill it in:

   ```sh
   cp scripts/bside.local.example.json scripts/bside.local.json
   ```

   `scripts/bside.local.json` is gitignored. Environment variables
   (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `BSIDE_PLAYLIST`,
   `BSIDE_PASSWORD`) work too and take precedence.

4. Build the payload:

   ```sh
   npm run sync:bside          # writes public/b-side/songs.enc.json
   npm run sync:bside -- --dry # fetch and report, write nothing
   ```

5. `npm run dev`, open <http://localhost:5173/b-side>, and check it.

6. Commit `public/b-side/songs.enc.json` and push. It has to be committed — it
   is the game's data.

## Previews

Spotify stopped returning `preview_url` for apps created after November 2024,
so the script falls back to Apple's public iTunes Search API, matching on
normalized title and artist. The run prints anything it could not match. Those
tracks stay in the guess list as decoys but are never the answer.

If too many come back empty, the usual causes are very new releases, regional
exclusives, or tracks whose Spotify title differs a lot from the Apple one.

## Changing the password

Re-run the sync with the new password — the password is baked into the
encryption, so there is no separate place to change it:

```sh
BSIDE_PASSWORD='something-else' npm run sync:bside
```

Then commit the regenerated file.

## What the password actually does

The song list is real AES-256-GCM ciphertext with a PBKDF2-derived key
(310,000 iterations, SHA-256). There is no password hash stored anywhere and no
`if (password === …)` to patch out; a wrong password simply fails the
authentication tag. Viewing source gets you nothing but the blob.

That said, the blob is public, so anyone who finds the URL can guess at it
offline for as long as they like, and `12345678` is near the top of every
wordlist. Treat this as a lock on a door, not a safe: it keeps the page from
being stumbled into, indexed, or casually opened. Do not put anything here you
would mind a determined stranger seeing.

The page also sets `noindex, nofollow, noarchive, nosnippet`, and the route is
absent from the nav in `SiteLayout.jsx`. If you ever add it there, it stops
being unlisted.

## Gameplay

Six attempts, unlocking 1s → 2s → 4s → 7s → 11s → 16s of the clip. Guesses come
from the playlist itself. **Daily** picks one track per calendar day and
remembers the round across refreshes; **Shuffle** is endless. Streaks live in
`localStorage`. Space bar plays.
