/**
 * Instant Top-3 SSE streaming for the native (non-Dify) chat engine.
 *
 * Streams facility data to the client as SSE events before the LLM
 * refinement step. This is the first response in handleNativeFastTop3Chat.
 *
 * Not yet implemented — the native chat engine bypass is controlled by
 * NATIVE_CHAT_USE_LLM=1 in .env.production (currently disabled).
 * When enabled, this function should write facility matches to the
 * SSE response before the LLM refines them.
 */

export function streamInstantTop3ToSse(res, query, inputs) {
  // TODO: Implement instant Top-3 facility retrieval and SSE streaming.
  // For now, this is a no-op. The native chat engine is not yet active
  // (DIFY_APP_KIND defaults to 'chat', using Dify).
}
