import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function Home({ page }) {
  if (!page) {
    return <div>Failed to load homepage content</div>
  }

  // Function to filter out unpublished content
  const filterPublishedContent = (content) => {
    // Remove any sections marked as draft
    return content
      .replace(/<div[^>]*class="[^"]*draft[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<!--.*?-->/g, '')
      .trim();
  };

  const filteredContent = filterPublishedContent(page.content.rendered);

  return (
    <>
      <Head>
        <title>{page.title.rendered}</title>
        <meta name="description" content="AI Assist Living Finder - Massachusetts Assisted Living" />
      </Head>

      <main className={styles.main}>
        <div dangerouslySetInnerHTML={{ __html: filteredContent }} />
      </main>
    </>
  )
}

export async function getStaticProps() {
  try {
    const res = await fetch("https://aiassistliving.com/wp-json/wp/v2/pages?slug=home")
    const data = await res.json()
    return {
      props: {
        page: data[0] || null
      },
      revalidate: 60
    }
  } catch (error) {
    console.error("Failed to fetch homepage:", error)
    return {
      props: {
        page: null
      }
    }
  }
}
