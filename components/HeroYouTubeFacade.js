import { useCallback, useState } from "react";
import Image from "next/image";
import styles from "../styles/Home.module.css";

const VIDEO_ID = "6f4i0VEgFWI";
const EMBED_SRC =
    "https://www.youtube-nocookie.com/embed/6f4i0VEgFWI" +
    "?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1";

export default function HeroYouTubeFacade() {
    const [active, setActive] = useState(false);
    const activate = useCallback(() => setActive(true), []);

    return (
        <div>
            <div className={styles.founderVideoWrap}>
                {!active && (
                    <h2 className={styles.videoInviteBanner}>
                        Watch why I created this service.
                    </h2>
                )}
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
                        title="Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share"
                        allowFullScreen
                    />
                )}
            </div>
        </div>
    );
}
