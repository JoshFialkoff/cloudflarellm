/** Append auth verification query params for client-side analytics after magic-link click. */
export function appendAuthVerifiedQuery(path, authSurface) {
    const raw = String(path || "/").trim() || "/";
    try {
        const url = new URL(raw, "https://assistedly.ai");
        url.searchParams.set("auth_verified", "1");
        if (authSurface) url.searchParams.set("auth_surface", authSurface);
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        const join = raw.includes("?") ? "&" : "?";
        const surface = authSurface
            ? `${join}auth_verified=1&auth_surface=${encodeURIComponent(authSurface)}`
            : `${join}auth_verified=1`;
        return `${raw}${surface}`;
    }
}
