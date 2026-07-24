import styles from './SpotifyEmbed.module.css';

export default function SpotifyEmbed({ trackId }) {
  return (
    <iframe
      className={styles.iframe}
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width="100%"
      allowFullScreen=""
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title={`Spotify track ${trackId}`}
    />
  );
}
