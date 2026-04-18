import { captureLandingEvent } from "../lib/landingAnalytics";
import styles from "../styles/Home.module.css";

export default function HomeHeroActions({ homepage_layout }) {
    return (
        <div className={styles.heroActions}>
            <a
                href="#assistant"
                className={styles.searchBtn}
                onClick={() =>
                    captureLandingEvent("landing_hero_link_click", {
                        homepage_layout,
                        cta_id: "start_match",
                    })
                }
            >
                Start 2-Minute Match
            </a>
            <a
                href="#how-it-works"
                className={styles.heroLinkBtn}
                onClick={() =>
                    captureLandingEvent("landing_hero_link_click", {
                        homepage_layout,
                        cta_id: "see_how_it_works",
                    })
                }
            >
                See How It Works
            </a>
        </div>
    );
}
