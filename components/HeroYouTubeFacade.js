import { useCallback, useState } from "react";
import Image from "next/image";
import {
    HOMEPAGE_LAYOUT,
    captureLandingEvent,
} from "../lib/landingAnalytics";
import styles from "../styles/Home.module.css";

const VIDEO_ID = "6f4i0VEgFWI";
const EMBED_SRC =
    "https://www.youtube-nocookie.com/embed/6f4i0VEgFWI" +
    "?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1";

export default function HeroYouTubeFacade({
    homepageLayout = HOMEPAGE_LAYOUT.youtube_facade,
    inviteTitle = "Watch why I created this service.",
    iframeTitle = "Video",
}) {
    const [active, setActive] = useState(false);
    const activate = useCallback(() => {
        captureLandingEvent("landing_hero_video_play", {
            homepage_layout: homepageLayout,
            video_id: VIDEO_ID,
        });
        setActive(true);
    }, [homepageLayout]);

    return (
        <div>
            <p className={styles.videoInviteTitle}>{inviteTitle}</p>
            <div className={styles.founderVideoWrap}>
                {!active ? (
                    <button
                        type="button"
                        className={styles.videoFacade}
                        onClick={activate}
                        aria-label="Play video: AI Assisted Living introduction"
                    >
                        <Image
                            src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
                            alt=""
                            fill
                            priority
                            fetchPriority="high"
                            className={styles.videoPoster}
                            sizes="(max-width: 900px) 100vw, 520px"
                        />
                        <span className={styles.videoPlayRing} aria-hidden>
                            <span className={styles.videoPlayTriangle} />
                        </span>
                    </button>
                ) : (
                    <iframe
                        className={styles.videoIframeActive}
                        src={`${EMBED_SRC}&autoplay=1`}
                        title={iframeTitle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                        allowFullScreen
                    />
                )}
            </div>
        </div>
    );
}
