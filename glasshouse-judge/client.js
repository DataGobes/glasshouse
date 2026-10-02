/**
 * Minimal TypeSafe System One client (POST /v1/systemone) on global fetch.
 *
 * Deliberately not @typesafe-ai/sdk: the judge is optional, so Glasshouse
 * must install and run without any TypeSafe package. The request body is the
 * documented one ({model, state, questions}); the answer shapes match the
 * SDK's NoulResponse / ChoiceResponse.
 */

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);

class JudgeAPIError extends Error {
  constructor(status, body) {
    super(`TypeSafe API ${status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

function createClient({ apiKey, baseURL, timeoutMs = 30000, maxRetries = 3, fetchImpl = globalThis.fetch, sleep } = {}) {
  if (!apiKey) throw new Error("createClient: apiKey is required");
  const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const url = `${String(baseURL).replace(/\/+$/, "")}/v1/systemone`;

  async function systemOne(body) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await wait(Math.min(500 * 2 ** (attempt - 1), 8000));
      let res;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastErr = err; // connection failure or timeout: retry
        continue;
      }
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      if (res.ok) return parsed;
      lastErr = new JudgeAPIError(res.status, parsed);
      if (!RETRY_STATUSES.has(res.status)) throw lastErr;
    }
    throw lastErr;
  }

  return { systemOne };
}

module.exports = { createClient, JudgeAPIError };
