/**
 * Content-addressed answer cache. The key is a hash of the full request
 * (model + state + questions), so it changes whenever the evidence, a
 * question's wording or the pinned model changes, and never otherwise.
 *
 * Cached state includes third-party policy text: the default directory is
 * gitignored and must stay that way.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Stable JSON: object keys sorted, so key order never changes the hash.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(body) {
  return crypto.createHash("sha256").update(canonical(body)).digest("hex");
}

function createFileCache(dir) {
  const file = (key) => path.join(dir, key.slice(0, 2), `${key}.json`);
  return {
    get(key) {
      try { return JSON.parse(fs.readFileSync(file(key), "utf8")); } catch { return undefined; }
    },
    set(key, value) {
      fs.mkdirSync(path.dirname(file(key)), { recursive: true });
      fs.writeFileSync(file(key), JSON.stringify(value));
    },
  };
}

function createMemoryCache() {
  const m = new Map();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v), size: () => m.size };
}

/**
 * Wraps a client so every call goes through the cache. Without a client
 * (no API key) cache hits still work, so a replay can be re-scored offline.
 */
function cachedSystemOne({ client, cache, stats = { hits: 0, misses: 0 } }) {
  return async function systemOne(body) {
    const key = requestHash(body);
    const hit = cache && cache.get(key);
    if (hit !== undefined) { stats.hits++; return hit; }
    stats.misses++;
    if (!client) {
      const err = new Error("judge cache miss and no TypeSafe client (set TYPESAFE_API_KEY)");
      err.code = "NO_CLIENT";
      throw err;
    }
    const res = await client.systemOne(body);
    if (cache) cache.set(key, res);
    return res;
  };
}

module.exports = { canonical, requestHash, createFileCache, createMemoryCache, cachedSystemOne };
