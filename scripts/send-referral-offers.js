const { readStore, recordUserAuth } = require("../lib/mvpDataStore");
const { sendReferralOfferEmail } = require("../lib/referralCampaign");

async function main() {
  console.log("Starting referral offer job...");
  const store = await readStore();
  const users = Object.values(store.users);
  const now = new Date();

  let sentCount = 0;

  for (const user of users) {
    if (user.referralOfferSentAt) {
      continue; // Already sent
    }

    if (user.positiveReviewAt) {
      console.log(`Sending referral offer to ${user.email}`);
      const result = await sendReferralOfferEmail(user.email);
      if (result.sent) {
        await recordUserAuth(user.email, user.role, {
          referralOfferSentAt: now.toISOString(),
        });
        sentCount++;
      }
    }
  }

  console.log(`Sent ${sentCount} referral offers.`);
}

main().catch((error) => {
  console.error("Error sending referral offers:", error);
  process.exit(1);
});
