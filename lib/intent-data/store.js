/**
 * File-backed JSON store for AIDP.
 * Persistent in `.data/intent-store.json` relative to project root.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const STORE_DIR = join(process.cwd(), ".data");
const STORE_FILE = join(STORE_DIR, "intent-store.json");

function ensureStoreDir() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function loadStore() {
  ensureStoreDir();
  if (!existsSync(STORE_FILE)) {
    return { accounts: [], contacts: [], audiences: [], events: [], campaigns: [] };
  }
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  } catch {
    return { accounts: [], contacts: [], audiences: [], events: [], campaigns: [] };
  }
}

function saveStore(data) {
  ensureStoreDir();
  writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

let cache = null;
let lastMtime = 0;

function mtime() {
  try {
    const s = require("fs").statSync(STORE_FILE);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

export function getStore() {
  const t = mtime();
  if (!cache || t !== lastMtime) {
    cache = loadStore();
    lastMtime = t;
  }
  return cache;
}

export function setStore(data) {
  cache = data;
  saveStore(data);
  lastMtime = mtime();
}

export function resetStore() {
  const empty = { accounts: [], contacts: [], audiences: [], events: [], campaigns: [] };
  setStore(empty);
  return empty;
}
