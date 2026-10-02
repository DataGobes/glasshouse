/**
 * Splits policy text into clauses with stable IDs, then packs clauses into
 * windows that fit one System One request (a Choice takes at most 255
 * options, and state should stay small).
 *
 * Clause IDs are positional ("c0001"), so the same text always yields the
 * same IDs and the same request hashes.
 */

const HEADING_MAX = 90;

function isHeading(line) {
  return line.length <= HEADING_MAX && !/[.;:!?]["')\]]?$/.test(line);
}

// Splits an over-long paragraph on sentence ends, packing sentences up to max.
function splitLong(text, max) {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]?\s*|$)/g) || [text];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > max) { out.push(cur.trim()); cur = ""; }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
      continue;
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

function segmentClauses(text, { clauseMaxChars = 1200 } = {}) {
  const lines = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Headings ride along with the paragraph they introduce, so a clause that
  // says "Retention" in its heading and "12 months" in its body is one unit.
  const paras = [];
  let pending = [];
  for (const line of lines) {
    if (isHeading(line)) { pending.push(line); continue; }
    paras.push([...pending, line].join(" — "));
    pending = [];
  }
  if (pending.length) paras.push(pending.join(" — "));

  const clauses = [];
  for (const p of paras) {
    for (const piece of splitLong(p, clauseMaxChars)) {
      clauses.push({ id: `c${String(clauses.length + 1).padStart(4, "0")}`, text: piece });
    }
  }
  return clauses;
}

function windowClauses(clauses, { windowMaxChars = 16000, windowMaxClauses = 254 } = {}) {
  const windows = [];
  let cur = [];
  let chars = 0;
  for (const c of clauses) {
    if (cur.length && (cur.length >= windowMaxClauses || chars + c.text.length > windowMaxChars)) {
      windows.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(c);
    chars += c.text.length;
  }
  if (cur.length) windows.push(cur);
  return windows;
}

module.exports = { segmentClauses, windowClauses };
