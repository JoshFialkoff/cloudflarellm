/**
 * Homepage #assistant implementation (see `components/HomeAssistantShell.js`).
 *
 * - Unset / empty / `wizard` → AssistedlyWizard + `/api/chat` (Dify)
 * - `player` → in-house `TypebotPlayer` + `typebots/homepage-ai-assistant.player.json` + `/api/bots/llm-stream`
 * - `typebot` → legacy @typebot.io/react embed (`NEXT_PUBLIC_TYPEBOT_ID`)
 */
export function homepageAssistantMode() {
    const raw = process.env.NEXT_PUBLIC_HOMEPAGE_ASSISTANT;
    const v = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (v === "typebot") return "typebot";
    if (v === "player") return "player";
    if (v === "wizard" || v === "") return "wizard";
    return "wizard";
}

export function homepageUsesTypebotEmbed() {
    return homepageAssistantMode() === "typebot";
}

export function homepageUsesPlayerBranch() {
    return homepageAssistantMode() === "player";
}
