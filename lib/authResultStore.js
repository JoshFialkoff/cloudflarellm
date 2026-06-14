const crypto = require("crypto");

const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const snapshots = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [id, entry] of snapshots.entries()) {
    if (!entry?.exp || entry.exp <= now) snapshots.delete(id);
  }
}

function saveResultSnapshot(email, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  pruneExpired();
  const id = crypto.randomBytes(12).toString("base64url");
  snapshots.set(id, {
    email: String(email || "").trim().toLowerCase(),
    snapshot,
    exp: Date.now() + SNAPSHOT_TTL_MS,
  });
  return id;
}

function getResultSnapshot(snapshotId) {
  if (!snapshotId) return null;
  const entry = snapshots.get(String(snapshotId));
  if (!entry) return null;
  if (!entry.exp || Date.now() > entry.exp) {
    snapshots.delete(String(snapshotId));
    return null;
  }
  return entry.snapshot || null;
}

module.exports = {
  getResultSnapshot,
  saveResultSnapshot,
};
