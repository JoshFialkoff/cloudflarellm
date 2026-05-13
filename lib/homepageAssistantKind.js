/**
 * Homepage assistant: in-house streaming player (default) vs legacy Typebot embed.
 * Set `NEXT_PUBLIC_HOMEPAGE_ASSISTANT=typebot` to restore the @typebot.io/react embed.
 */
export function homepageUsesTypebotEmbed() {
    return process.env.NEXT_PUBLIC_HOMEPAGE_ASSISTANT === "typebot";
}
