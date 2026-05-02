import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo } from "react";
import LandingBanner from "../../components/LandingBanner";
import TypebotPlayer from "../../components/TypebotPlayer";
import styles from "../../styles/Tools.module.css";
import { captureLandingEvent } from "../../lib/landingAnalytics";

/**
 * Dynamic bot page: /bots/[slug]
 * Loads a player-format JSON from /typebots/<slug>.player.json at build time.
 * All Typebot flows in /typebots/*.player.json are rendered here.
 */
export default function BotPage({ flow, slug }) {
    const router = useRouter();

    const prefill = useMemo(() => {
        if (!router.isReady) return {};
        const q = router.query;
        return {
            care_type: q.care_type ?? "",
            region: q.region ?? "",
            monthly_budget: q.monthly_budget ?? "",
            estimated_low: q.estimated_low ?? "",
            estimated_high: q.estimated_high ?? "",
        };
    }, [router.isReady, router.query]);

    const handleComplete = (answers) => {
        captureLandingEvent("typebot_player_bot_completed", {
            bot_slug: slug,
            answer_count: Object.keys(answers).length,
        });
    };

    if (!flow) {
        return (
            <main className={styles.toolPage}>
                <section className={styles.hero}>
                    <p>Bot not found.</p>
                </section>
            </main>
        );
    }

    return (
        <>
            <Head>
                <title>{flow.name} | Assistedly</title>
                <meta name="description" content={flow.description ?? flow.name} />
            </Head>
            <main className={styles.toolPage}>
                <LandingBanner headlineOverride="Access Exclusive Data to Find Best Massachusetts Assisted Living" />
                <section className={styles.hero}>
                    <p className={styles.kicker}>Free Massachusetts care tool</p>
                    <h1>{flow.name}</h1>
                    {flow.description ? (
                        <p className={styles.heroCopy}>{flow.description}</p>
                    ) : null}
                </section>
                <section
                    className={styles.toolShell}
                    style={{ gridTemplateColumns: "minmax(0,1fr)" }}
                    aria-label={flow.name}
                >
                    <TypebotPlayer
                        flow={flow}
                        prefill={prefill}
                        onComplete={handleComplete}
                    />
                </section>
            </main>
        </>
    );
}

export async function getStaticPaths() {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.cwd(), "typebots");
    const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.endsWith(".player.json"))
        : [];
    return {
        paths: files.map((f) => ({
            params: { slug: f.replace(/\.player\.json$/, "") },
        })),
        fallback: false,
    };
}

export async function getStaticProps({ params }) {
    const fs = require("fs");
    const path = require("path");
    const file = path.join(
        process.cwd(),
        "typebots",
        `${params.slug}.player.json`,
    );
    if (!fs.existsSync(file)) {
        return { notFound: true };
    }
    const flow = JSON.parse(fs.readFileSync(file, "utf8"));
    return { props: { flow, slug: params.slug } };
}
