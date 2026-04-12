/**
 * Client-only Typebot embed loading.
 * Uses a lazy singleton so callers can delay `import("@typebot.io/react")`
 * (e.g. below-the-fold mobile) without paying the chunk cost on first paint.
 */

const DEFAULT_VIEWER_HOST =
    "https://bot-typebot-viewer.dqwglw.easypanel.host";

function viewerOrigin() {
    const host =
        process.env.NEXT_PUBLIC_TYPEBOT_API_HOST || DEFAULT_VIEWER_HOST;
    try {
        return new URL(host).origin;
    } catch {
        return host;
    }
}

let typebotReactModulePromiseSingleton = null;
let viewerNetworkWarmed = false;

/**
 * Cheap connection warm-up to the Typebot viewer origin (runs at most once per session).
 */
export function prefetchTypebotViewerNetwork() {
    if (typeof window === "undefined" || viewerNetworkWarmed) return;
    viewerNetworkWarmed = true;
    const origin = viewerOrigin();
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
        typebotReactModulePromiseSingleton = import("@typebot.io/react");
    }
    return typebotReactModulePromiseSingleton;
}
