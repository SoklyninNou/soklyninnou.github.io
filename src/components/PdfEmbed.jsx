import styles from './PdfEmbed.module.css';

export default function PdfEmbed({ src, title }) {
  return (
    <object className={styles.pdf} data={src} type="application/pdf" aria-label={title}>
      <p>
        Your browser can&apos;t preview this PDF. <a href={src}>Open {title}</a>.
      </p>
    </object>
  );
}
