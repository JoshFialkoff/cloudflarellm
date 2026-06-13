import { PostHog } from "posthog-node";

let client = null;

export function getPosthogServer() {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return null;
    if (!client) {
        client = new PostHog(key, {
            host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        });
    }
    return client;
}

/**
 * Report a generation to PostHog LLM observability ($ai_generation).
 */
export function captureAiGeneration(distinctId, properties = {}) {
    const ph = getPosthogServer();
    if (!ph) return;

    ph.capture({
        distinctId: distinctId || "anonymous",
        event: "$ai_generation",
        properties: {
            $ai_http_status: 200,
            ...properties,
        },
    });
}

export async function flushPosthogServer() {
    await client?.flush?.();
}
