import Head from 'next/head'
import { Children } from 'react'
import Image from 'next/image'
import styles from '../styles/BrandStoryPageWrapper.module.css'

function StoryDivider() {
  return <hr className={styles.divider} aria-hidden="true" />
}

export default function BrandStoryPageWrapper({
  headTitle,
  headDescription,
  eyebrow,
  title,
  subtitle,
  founderName,
  founderRole,
  founderImageSrc,
  founderImageAlt,
  videoTitle,
  videoDescription,
  children,
}) {
  const storySections = Children.toArray(children).filter(Boolean)

  return (
    <>
      <Head>
        <title>{headTitle}</title>
        <meta name="description" content={headDescription} />
      </Head>

      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>

          <div className={styles.mediaColumn}>
            <section className={styles.card} aria-label="Founder profile">
              <Image
                className={styles.founderImage}
                src={founderImageSrc}
                alt={founderImageAlt}
                width={960}
                height={600}
                unoptimized
              />
              <div className={styles.founderMeta}>
                <p className={styles.founderName}>{founderName}</p>
                <p className={styles.founderRole}>{founderRole}</p>
              </div>
            </section>

            <section className={styles.videoCard} aria-label="Founder story video preview">
              <div className={styles.videoBadge}>Video Placeholder</div>
              <h2>{videoTitle}</h2>
              <p>{videoDescription}</p>
            </section>
          </div>
        </section>

        <article className={styles.story}>
          {storySections.flatMap((child, index) =>
            index === 0 ? [child] : [<StoryDivider key={`divider-${index}`} />, child]
          )}
        </article>

        <footer className={styles.footer}>
          <p>© {new Date().getFullYear()} Assistedly.ai</p>
        </footer>
      </main>
    </>
  )
}
