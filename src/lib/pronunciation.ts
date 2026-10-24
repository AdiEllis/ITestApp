/**
 * The teacher's pronunciation dictionary: words the read-aloud voice gets wrong, and how to write them
 * so it reads them right (with niqqud, in full spelling, or spelled the way they sound). Applied to the
 * text sent to the voice only; students still see the question as written.
 */

export const PRONUNCIATION_MAX = 300;

export interface PronunciationEntry {
  written: string;
  spoken: string;
}

const NIQQUD = /[֑-ׇ]/g;

/** The form a dictionary word is stored and matched in: trimmed, single spaces, no niqqud. */
export function normalizeWritten(s: string) {
  return s.replace(NIQQUD, "").trim().replace(/\s+/g, " ");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces each whole word (or phrase) from the dictionary. A word only matches on its own, so "ספר"
 * does not change "מספר". Longer phrases win over the words inside them.
 */
export function applyPronunciation(text: string, entries: PronunciationEntry[]): string {
  const sorted = entries.filter((e) => e.written && e.spoken).sort((a, b) => b.written.length - a.written.length);
  if (!sorted.length) return text;
  const byWord = new Map(sorted.map((e) => [e.written, e.spoken]));
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${sorted.map((e) => e.written.split(" ").map(escapeRe).join("\\s+")).join("|")})(?![\\p{L}\\p{M}\\p{N}])`, "gu");
  return text.replace(re, (m) => byWord.get(m.replace(/\s+/g, " ")) ?? m);
}
