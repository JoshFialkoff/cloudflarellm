import { TYPEBOT_DEFAULT_VIEWER_HOST } from "./typebotEnv";
import {
    getTypebotReactModulePromise,
    prefetchTypebotViewerNetwork,
} from "./typebotReactClient";

export const TYPEBOT_PUBLIC_ID =
    process.env.NEXT_PUBLIC_TYPEBOT_ID || "1-31-26-working-thio-ass-living-k3253lu";

export const TYPEBOT_API_HOST =
    process.env.NEXT_PUBLIC_TYPEBOT_API_HOST || TYPEBOT_DEFAULT_VIEWER_HOST;

export const TYPEBOT_API_ORIGIN = (() => {
    try {
        return new URL(TYPEBOT_API_HOST).origin;
    } catch {
        return TYPEBOT_API_HOST;
    }
})();

if (typeof window !== "undefined") {
    prefetchTypebotViewerNetwork();
    const narrow =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 900px)").matches;
    if (!narrow) {
        void getTypebotReactModulePromise();
    }
}
