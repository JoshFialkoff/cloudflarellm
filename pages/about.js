import { useEffect, useState } from 'react'
import Head from 'next/head'
import { getPageBySlug } from '../lib/wordpress'
import styles from '../styles/Home.module.css'

export default function About({ content }) {
  const [pageContent, setPageContent] = useState(content)

  useEffect(() => {
    if (!content) {
      fetch('/app/api/wordpress/about-us')
        .then(res => res.json())
        .then(data => setPageContent(data))
    }
  }, [])

  if (!pageContent) {
    return <div>Loading...</div>
  }

  return (
    <>
      <Head>
        <title>{pageContent.title?.rendered || 'About'}</title>
        <meta name="description" content="AI Assist Living Finder - Massachusetts Assisted Living" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>{pageContent.title?.rendered || 'About'}</h1>
        <div dangerouslySetInnerHTML={{ __html: pageContent.content?.rendered }} />
      </main>
    </>
  )
}

export async function getStaticProps() {
  const page = await getPageBySlug('about')
  return {
    props: {
      content: page || null
    },
    revalidate: 60
  }
}
