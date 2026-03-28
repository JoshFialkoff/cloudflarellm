import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";

export default function NotFound() {
    return (
        <>
            <Head>
                <title>Page not found — AI Assist Living Finder</title>
                <meta name="robots" content="noindex" />
            </Head>

            <section
                className={styles.hero}
                style={{ textAlign: "center" }}
            >
                <div
                    className={styles.heroContent}
                    style={{ margin: "0 auto", maxWidth: "640px" }}
                >
                    <h1 className={styles.heroTitle}>Page not found</h1>
                    <p className={styles.heroSubtitle}>
                        That URL doesn&apos;t exist or may have moved. Try the
                        home page or search to find assisted living in
                        Massachusetts.
                    </p>
                    <p style={{ marginTop: "1.5rem" }}>
                        <Link href="/" className={styles.searchBtn}>
                            Back to home
                        </Link>
                    </p>
                </div>
            </section>
        </>
    );
}
