/** Default Typebot viewer (Easypanel). Override with NEXT_PUBLIC_TYPEBOT_API_HOST. */
export const TYPEBOT_DEFAULT_VIEWER_HOST =
    "https://bot-typebot-viewer.dqwglw.easypanel.host";

/** Origin string for preconnect / prefetch (no trailing slash). */
export function typebotViewerOrigin() {
    const host =
        process.env.NEXT_PUBLIC_TYPEBOT_API_HOST || TYPEBOT_DEFAULT_VIEWER_HOST;
    try {
        return new URL(host).origin;
    } catch {
        return host;
    }
}
