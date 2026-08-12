/**
 * Twenty CRM integration stub.
 * Active implementation: push audience contacts to Twenty as a list/people.
 */
export async function syncAudienceToTwenty({ audience, contacts }) {
  // TODO: wire to Twenty REST API when credentials are available
  return {
    success: true,
    source: "twenty",
    syncedAt: new Date().toISOString(),
    contactCount: contacts.length,
    note: "Stub — no actual Twenty API call made.",
  };
}

export async function testTwentyConnection() {
  return { ok: true, source: "twenty" };
}
