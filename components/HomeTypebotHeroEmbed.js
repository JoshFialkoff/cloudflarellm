import styles from "../styles/Home.module.css";
import { TYPEBOT_API_HOST, TYPEBOT_PUBLIC_ID } from "../lib/homeTypebotBootstrap";

export default function HomeTypebotHeroEmbed({
    typebotSectionRef,
    TypebotStandard,
    typebotImportError,
    onRetryTypebotImport,
    onInit,
    onNewInputBlock,
    onAnswer,
    onEnd,
}) {
    return (
        <div className={styles.heroVideoSlot}>
            <section
                ref={typebotSectionRef}
                className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                id="assistant"
                aria-label="AI assistant chat"
            >
                <div className={styles.heroTypebotFrame}>
                    {TypebotStandard ? (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                            }}
                        >
                            <TypebotStandard
                                typebot={TYPEBOT_PUBLIC_ID}
                                apiHost={TYPEBOT_API_HOST}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    height: "100%",
                                    border: 0,
                                }}
                                onInit={onInit}
                                onNewInputBlock={onNewInputBlock}
                                onAnswer={onAnswer}
                                onEnd={onEnd}
                            />
                        </div>
                    ) : typebotImportError ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="alert"
                            aria-live="assertive"
                        >
                            <p>
                                The assistant could not load (network or script
                                blocked).
                            </p>
                            {typeof onRetryTypebotImport === "function" ? (
                                <button
                                    type="button"
                                    className={styles.ctaBtn}
                                    onClick={onRetryTypebotImport}
                                >
                                    Try again
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="status"
                            aria-live="polite"
                            aria-label="AI assistant is loading"
                        >
                            <span
                                className={styles.typebotLoadingSpinner}
                                aria-hidden
                            />
                            Loading assistant…
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
