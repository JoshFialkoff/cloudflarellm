import { useLayoutEffect, useRef, useState } from "react";
import {
    getTypebotReactModulePromise,
    prefetchTypebotViewerNetwork,
} from "../lib/typebotReactClient";

/** Matches `Home.module.css` hero stack breakpoint (typebot moves below fold). */
const MOBILE_DEFER_MQ = "(max-width: 900px)";
const NEAR_VIEWPORT_MARGIN = "380px 0px";
/** If user has not scrolled to the embed yet, still start loading after this (ms). */
const MOBILE_IDLE_KICK_MS = 2200;

/**
 * Loads `@typebot.io/react` `Standard` as early as possible without hurting
 * mobile first paint: desktop loads immediately; mobile waits until the embed
 * is near the viewport or a capped idle timeout, whichever comes first.
 */
export function useTypebotStandardLoader() {
    const sectionRef = useRef(null);
    const [TypebotStandard, setTypebotStandard] = useState(null);
    const startedRef = useRef(false);

    useLayoutEffect(() => {
        if (typeof window === "undefined") return undefined;

        let cancelled = false;
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
            if (cancelled || startedRef.current) return;
            startedRef.current = true;
            clearIdleKick();
            if (ioRef) {
                ioRef.disconnect();
                ioRef = null;
            }

            prefetchTypebotViewerNetwork();
            const modPromise = getTypebotReactModulePromise();
            if (!modPromise) return;
            void modPromise
                .then((mod) => {
                    if (!cancelled) {
                        setTypebotStandard(() => mod.Standard);
                    }
                })
                .catch(() => undefined);
        };

        const isMobileLayout =
            typeof window.matchMedia === "function" &&
            window.matchMedia(MOBILE_DEFER_MQ).matches;

        if (!isMobileLayout) {
            begin();
            return () => {
                cancelled = true;
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
            cancelled = true;
            io.disconnect();
            clearIdleKick();
        };
    }, []);

    return { typebotSectionRef: sectionRef, TypebotStandard };
}
