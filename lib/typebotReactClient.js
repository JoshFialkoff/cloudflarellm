/**
 * Client-only: begin loading @typebot.io/react as soon as the importing page chunk runs,
 * before React effects (so the network request starts earlier than useEffect).
 */
export const typebotReactModulePromise =
    typeof window !== "undefined" ? import("@typebot.io/react") : null;
