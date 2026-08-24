/* global fetch */
function cloudflareAuthHeaders() {
  const email = process.env.CLOUDFLARE_EMAIL;
  const token = process.env.CLOUDFLARE_ROTATION_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (email) {
    return { "X-Auth-Email": email, "X-Auth-Key": token };
  }
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const targetId = process.argv[2];
  if (!targetId) {
    console.error("Usage: node delete-token.mjs <token-id>");
    process.exit(1);
  }
  console.log(`Deleting token ${targetId}...`);
  const res = await fetch(`https://api.cloudflare.com/client/v4/user/tokens/${targetId}`, {
    method: "DELETE",
    headers: cloudflareAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    console.error("Failed:", JSON.stringify(body.errors || body));
    process.exit(1);
  }
  console.log("Deleted.");
}
main();
