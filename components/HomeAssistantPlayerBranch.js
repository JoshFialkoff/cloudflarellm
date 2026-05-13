import { useEffect, useRef } from "react";
import TypebotPlayer from "./TypebotPlayer";
import styles from "../styles/Home.module.css";
import homepageFlow from "../typebots/homepage-ai-assistant.player.json";
import { captureLandingEvent } from "../lib/landingAnalytics";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";

/**
 * Default homepage assistant: in-house TypebotPlayer + OpenAI streaming
 * (`/api/bots/llm-stream`), matching Typebot’s “stream AI response” behavior
 * without loading `@typebot.io/react`.
 */
export default function HomeAssistantPlayerBranch({
    prefilledVariables,
    homepage_layout,
}) {
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        captureLandingEvent("landing_typebot_ready", {
            homepage_layout,
            assistant_mode: "player_streaming",
        });
        captureLandingEvent("typebot_started", {
            homepage_layout,
            assistant_mode: "player_streaming",
        });
    }, [homepage_layout]);

    const handleComplete = () => {
        captureLandingEvent("typebot_completed", {
            homepage_layout,
            assistant_mode: "player_streaming",
        });
        pushConversionDataLayer({
            event: "typebot_completed",
            lead_source: "homepage_player_assistant",
        });
    };

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
                        onComplete={handleComplete}
                    />
                </div>
            </section>
        </div>
    );
}
