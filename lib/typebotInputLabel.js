export function stripHtml(html) {
  if (html == null) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort label from Typebot input block (shape varies by block type). */
export function typebotInputLabel(input) {
  if (!input || typeof input !== "object") return "";

  const raw =
    input.label ??
    input.groupLabel ??
    (typeof input.placeholder === "string" ? input.placeholder : null);
  if (raw) return stripHtml(raw);

  const items = input.items;
  if (Array.isArray(items) && items.length) {
    const t = items[0]?.title ?? items[0]?.content;
    if (t) return stripHtml(String(t));
  }

  return "";
}

export function isLikelyNameQuestionStep(blockId, label, nameBlockIds) {
  if (blockId && nameBlockIds.has(blockId)) return true;
  const t = (label || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (t.includes("what's your name") || t.includes("what is your name"))
    return true;
  if (/\bname\b/.test(t) && /\b(your|what|enter|full)\b/.test(t)) return true;
  return false;
}
