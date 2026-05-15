import TypebotPlayer from "./TypebotPlayer";
import styles from "../styles/Home.module.css";
import homepageFlow from "../typebots/homepage-ai-assistant.player.json";

/**
 * Homepage assistant: in-house TypebotPlayer (no third-party embed).
 * Analytics: GTM dataLayer via TypebotPlayer (no Typebot GA blocks).
 */
export default function HomeAssistantPlayerBranch({
    prefilledVariables,
    homepage_layout,
}) {
    return (
        <div className={styles.heroVideoSlot}>
            <section
                className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                id="assistant"
                aria-label="AI assistant chat"
            >
                <div className={styles.heroTypebotFrame}>
                    <TypebotPlayer
                        flow={homepageFlow}
                        prefill={prefilledVariables}
                        className={styles.homePlayerAssistant}
                        homepage_layout={homepage_layout}
                        analyticsMode="homepage"
                    />
                </div>
            </section>
        </div>
    );
}
