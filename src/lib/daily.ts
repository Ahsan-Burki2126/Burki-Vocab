/**
 * Daily word picker.
 *
 * Goal: a small set of NEW words each day that (1) spreads across as many different
 * letters as possible, rotating so every letter A–Z gets touched within a few days,
 * and (2) inside each letter takes the word with the highest exam-likelihood score.
 *
 * Algorithm
 *  - Pool = words never learned and not marked "known".
 *  - Letters are ordered: never-touched letters first, then the letter touched longest
 *    ago; ties go to the letter whose best remaining word scores highest.
 *  - Take the top-scoring word from each letter in that order (round-robin), then
 *    start a second pass if the target is bigger than the number of letters left.
 *  - Unfinished words from the previous study day carry over first.
 */
import type { AppState, DayLog, Word } from '../types';
import { LETTERS, WORDS, WORD_BY_ID, letterOf } from './data';

export function letterLastTouched(days: Record<string, DayLog>, beforeOrOn?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(days).sort()) {
    if (beforeOrOn && key > beforeOrOn) continue;
    for (const id of days[key].words) {
      const l = id[0].toUpperCase();
      if (!out[l] || out[l] < key) out[l] = key;
    }
  }
  return out;
}

export function pickWords(opts: {
  count: number;
  exclude: Set<string>;
  letterLast: Record<string, string>;
  cards: AppState['cards'];
  preferLetter?: string;
}): string[] {
  const { count, exclude, letterLast, cards, preferLetter } = opts;
  if (count <= 0) return [];

  const pools: Record<string, Word[]> = {};
  for (const w of WORDS) {
    if (cards[w.id] || exclude.has(w.id)) continue;
    const l = letterOf(w);
    (pools[l] ||= []).push(w);
  }
  for (const l of Object.keys(pools)) {
    pools[l].sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  }

  const order = LETTERS.filter((l) => pools[l]?.length).sort((a, b) => {
    if (preferLetter) {
      if (a === preferLetter) return -1;
      if (b === preferLetter) return 1;
    }
    const la = letterLast[a] ?? '';
    const lb = letterLast[b] ?? '';
    if (la !== lb) return la < lb ? -1 : 1;
    const sa = pools[a][0].score;
    const sb = pools[b][0].score;
    if (sa !== sb) return sb - sa;
    return a < b ? -1 : 1;
  });

  const picked: string[] = [];
  let pass = 0;
  while (picked.length < count) {
    let progressed = false;
    for (const l of order) {
      const w = pools[l][pass];
      if (!w) continue;
      picked.push(w.id);
      progressed = true;
      if (picked.length >= count) break;
    }
    if (!progressed) break;
    pass++;
  }
  return picked;
}

const byWord = (a: string, b: string) => a.localeCompare(b);

/**
 * Makes sure today's log exists and matches the daily target.
 * Returns a new state object only if something changed.
 */
export function ensureToday(state: AppState, today: string): AppState {
  const target = state.settings.dailyTarget;
  const existing = state.days[today];

  if (existing && existing.words.length === Math.max(target, existing.learned.length) && existing.target === target) {
    return state;
  }

  const days = { ...state.days };

  if (!existing) {
    // carry over unfinished words from the most recent previous study day
    const prevKey = Object.keys(days)
      .filter((k) => k < today)
      .sort()
      .pop();
    const carry = prevKey
      ? days[prevKey].words.filter((id) => !days[prevKey].learned.includes(id) && !state.cards[id]).slice(0, target)
      : [];
    const fresh = pickWords({
      count: target - carry.length,
      exclude: new Set(carry),
      letterLast: letterLastTouched(days),
      cards: state.cards,
    });
    days[today] = {
      words: [...carry, ...fresh].sort(byWord),
      learned: [],
      target,
      practiceAnswered: 0,
      practiceCorrect: 0,
      reviewed: 0,
    };
    return { ...state, days };
  }

  const log = { ...existing, target };
  const need = Math.max(target, log.learned.length);
  if (log.words.length < need) {
    const more = pickWords({
      count: need - log.words.length,
      exclude: new Set(log.words),
      letterLast: letterLastTouched(days), // includes today's letters, so new picks go to other letters first
      cards: state.cards,
    });
    log.words = [...log.words, ...more].sort(byWord);
  } else if (log.words.length > need) {
    // drop the lowest-scoring unlearned words; keep everything already learned
    const unlearned = log.words
      .filter((id) => !log.learned.includes(id))
      .sort((a, b) => (WORD_BY_ID[a]?.score ?? 0) - (WORD_BY_ID[b]?.score ?? 0));
    const removeCount = log.words.length - need;
    const remove = new Set(unlearned.slice(0, removeCount));
    log.words = log.words.filter((id) => !remove.has(id));
  }
  if (log.words.length === existing.words.length && existing.target === target) {
    return state; // nothing left to add (word bank exhausted) — avoid re-render loops
  }
  days[today] = log;
  return { ...state, days };
}

/** Swap a word the learner already knows for the next best pick (same letter if possible). */
export function replaceWord(state: AppState, today: string, id: string): { state: AppState; replacement?: string } {
  const log = state.days[today];
  if (!log) return { state };
  const exclude = new Set(log.words);
  const letter = id[0].toUpperCase();
  const [replacement] = pickWords({
    count: 1,
    exclude,
    letterLast: letterLastTouched(state.days),
    cards: state.cards,
    preferLetter: letter,
  });
  const words = log.words.filter((w) => w !== id);
  if (replacement) words.push(replacement);
  return {
    state: { ...state, days: { ...state.days, [today]: { ...log, words: words.sort(byWord) } } },
    replacement,
  };
}

/** Days needed to touch every letter at the current pace. */
export function lettersCycleDays(target: number): number {
  return Math.ceil(26 / Math.max(1, Math.min(26, target)));
}
