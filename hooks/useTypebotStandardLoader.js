import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    getTypebotReactModulePromise,
    prefetchTypebotViewerNetwork,
    resetTypebotReactModulePromise,
} from "../lib/typebotReactClient";

/** Matches `Home.module.css` hero stack breakpoint (typebot moves below fold). */
const MOBILE_DEFER_MQ = "(max-width: 900px)";
/** Wider margin so the embed chunk starts before the user scrolls to it. */
const NEAR_VIEWPORT_MARGIN = "640px 0px";
/** If user has not scrolled to the embed yet, still start loading after this (ms). */
const MOBILE_IDLE_KICK_MS = 450;

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Loads `@typebot.io/react` `Standard` as early as possible without hurting
 * mobile first paint: desktop loads immediately; mobile waits until the embed
 * is near the viewport or a capped idle timeout, whichever comes first.
 */
export function useTypebotStandardLoader(analytics = {}) {
    const sectionRef = useRef(null);
    const [TypebotStandard, setTypebotStandard] = useState(null);
    const [typebotImportError, setTypebotImportError] = useState(null);
    const [retryKey, setRetryKey] = useState(0);
    const startedRef = useRef(false);
    const analyticsRef = useRef(analytics);
    /** Ref (not a render-cycle `let`) so Strict Mode remount + import().then stay correct. */
    const cancelledRef = useRef(false);

    useEffect(() => {
        analyticsRef.current = analytics;
    }, [analytics]);

    useIsoLayoutEffect(() => {
        if (typeof window === "undefined") return undefined;

        cancelledRef.current = false;
        let idleHandle;
        /** @type {"ric" | "timeout" | null} */
        let idleKind = null;

        const clearIdleKick = () => {
            if (idleHandle == null) return;
            if (idleKind === "ric" && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleHandle);
            } else {
                window.clearTimeout(idleHandle);
            }
            idleHandle = undefined;
            idleKind = null;
        };

        let ioRef = null;

        const begin = () => {
            if (cancelledRef.current || startedRef.current) return;
            startedRef.current = true;
            clearIdleKick();
            if (ioRef) {
                ioRef.disconnect();
                ioRef = null;
            }

            prefetchTypebotViewerNetwork();
            analyticsRef.current.onImportStarted?.();
            const modPromise = getTypebotReactModulePromise();
            if (!modPromise) return;
            void modPromise
                .then((mod) => {
                    if (!cancelledRef.current) {
                        if (!mod?.Standard) {
                            const err = new Error(
                                "@typebot.io/react has no Standard export",
                            );
                            console.error("[Typebot]", err);
                            setTypebotImportError(err.message);
                            analyticsRef.current.onImportFailed?.({
                                reason: "missing_standard_export",
                            });
                            return;
                        }
                        setTypebotStandard(() => mod.Standard);
                        analyticsRef.current.onImportSucceeded?.();
                    }
                })
                .catch((err) => {
                    console.error(
                        "[Typebot] Failed to load @typebot.io/react",
                        err,
                    );
                    if (!cancelledRef.current) {
                        setTypebotImportError(
                            err instanceof Error
                                ? err.message
                                : "Failed to load assistant",
                        );
                        analyticsRef.current.onImportFailed?.({
                            reason:
                                err instanceof Error
                                    ? err.message
                                    : "Failed to load assistant",
                        });
                    }
                });
        };

        const isMobileLayout =
            typeof window.matchMedia === "function" &&
            window.matchMedia(MOBILE_DEFER_MQ).matches;

        if (!isMobileLayout) {
            begin();
            return () => {
                cancelledRef.current = true;
                startedRef.current = false;
            };
        }

        const el = sectionRef.current;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    begin();
                }
            },
            { root: null, rootMargin: NEAR_VIEWPORT_MARGIN, threshold: 0 },
        );
        ioRef = io;

        if (el) {
            io.observe(el);
        }

        if (typeof window.requestIdleCallback === "function") {
            idleKind = "ric";
            idleHandle = window.requestIdleCallback(
                () => {
                    begin();
                },
                { timeout: MOBILE_IDLE_KICK_MS },
            );
        } else {
            idleKind = "timeout";
            idleHandle = window.setTimeout(() => {
                begin();
            }, MOBILE_IDLE_KICK_MS);
        }

        return () => {
            cancelledRef.current = true;
            startedRef.current = false;
            io.disconnect();
            clearIdleKick();
        };
    }, [retryKey]);

    const retryTypebotImport = () => {
        resetTypebotReactModulePromise();
        startedRef.current = false;
        setTypebotStandard(null);
        setTypebotImportError(null);
        setRetryKey((k) => k + 1);
    };

    return {
        typebotSectionRef: sectionRef,
        TypebotStandard,
        typebotImportError,
        retryTypebotImport,
    };
}
