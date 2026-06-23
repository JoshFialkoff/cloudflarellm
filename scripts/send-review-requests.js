const { readStore, recordUserAuth } = require("../lib/mvpDataStore");
const { sendReviewRequestEmail } = require("../lib/evangelistCampaign");

async function main() {
  console.log("Starting review request job...");
  const store = await readStore();
  const users = Object.values(store.users);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let sentCount = 0;

  for (const user of users) {
    if (user.reviewRequestSentAt) {
      continue; // Already sent
    }

    const createdAt = new Date(user.createdAt);
    const lastSeenAt = new Date(user.lastSeenAt);

    const isEligibleByActivity =
      createdAt <= thirtyDaysAgo && lastSeenAt >= thirtyDaysAgo;

    const hasUsedConsultation = user.usedConsultation; // Assuming this flag is set elsewhere

    if (isEligibleByActivity || hasUsedConsultation) {
      console.log(`Sending review request to ${user.email}`);
      const result = await sendReviewRequestEmail(user.email);
      if (result.sent) {
        await recordUserAuth(user.email, user.role, {
          reviewRequestSentAt: now.toISOString(),
        });
        sentCount++;
      }
    }
  }

  console.log(`Sent ${sentCount} review requests.`);
}

main().catch((error) => {
  console.error("Error sending review requests:", error);
  process.exit(1);
});
