import Head from "next/head";
import Link from "next/link";
import { SITE_TOOL_ENTRIES } from "../../lib/siteNavigation";
import styles from "../../styles/ToolsDirectory.module.css";

export default function ToolsDirectoryPage() {
  return (
    <>
      <Head>
        <title>Tools & guides | assistedly.AI</title>
        <meta
          name="description"
          content="Assistedly.AI tools for Massachusetts families: find safer care, estimate costs, search facilities, and get matched with advisors."
        />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className="container">
            <p className="siteHeaderKicker">Massachusetts senior care</p>
            <h1 className={styles.title}>Tools &amp; guides</h1>
            <p className={styles.lead}>
              Everything we offer in one place. New flows land here first so you can bookmark a single page while we
              ship.
            </p>
          </div>
        </header>

        <div className="container">
          <ul className={styles.grid}>
            {SITE_TOOL_ENTRIES.map((tool) => (
              <li key={tool.href} className={styles.card}>
                {tool.tag ? <span className={styles.tag}>{tool.tag}</span> : null}
                <h2 className={styles.cardTitle}>
                  <Link href={tool.href}>{tool.title}</Link>
                </h2>
                <p className={styles.cardBody}>{tool.description}</p>
                <Link href={tool.href} className={styles.cardCta}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
