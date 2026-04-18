/**
 * Client-only Typebot embed loading.
 * Uses a lazy singleton so callers can delay `import("@typebot.io/react")`
 * (e.g. below-the-fold mobile) without paying the chunk cost on first paint.
 */

import { typebotViewerOrigin } from "./typebotEnv";

let typebotReactModulePromiseSingleton = null;
let viewerNetworkWarmed = false;

/** Clears the lazy import so the next load fetches the chunk again (e.g. flaky network). */
export function resetTypebotReactModulePromise() {
    typebotReactModulePromiseSingleton = null;
}

/**
 * Cheap connection warm-up to the Typebot viewer origin (runs at most once per session).
 */
export function prefetchTypebotViewerNetwork() {
    if (typeof window === "undefined" || viewerNetworkWarmed) return;
    viewerNetworkWarmed = true;
    const origin = typebotViewerOrigin();
    void fetch(`${origin}/`, {
        mode: "no-cors",
        credentials: "omit",
    }).catch(() => undefined);
}

/**
 * @returns {Promise<typeof import("@typebot.io/react")> | null}
 */
export function getTypebotReactModulePromise() {
    if (typeof window === "undefined") return null;
    if (!typebotReactModulePromiseSingleton) {
        typebotReactModulePromiseSingleton = import(
            /* webpackPrefetch: true */ "@typebot.io/react"
        );
    }
    return typebotReactModulePromiseSingleton;
}
