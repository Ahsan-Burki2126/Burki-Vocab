/**
 * Daily word picker (v2).
 *
 * Goal: each day, a set of NEW words that gives the most exam value:
 *  1. Highest exam-likelihood words first.
 *  2. Spread across the WHOLE alphabet: one word per letter, with the letters scattered
 *     A→Z (e.g. A, F, K, P, T…) rather than a consecutive run like A–J.
 *  3. Letters rotate, so every letter gets covered over the next few days.
 *  4. A balanced mix of adjectives / verbs / nouns and positive / negative / neutral
 *     words, the way they are mixed in a real paper.
 *  5. Studied in pick order (best word first), not alphabetical order.
 *
 * How: greedy selection. Every candidate gets a utility score and the best one is
 * picked, then all scores are recomputed against what has been picked so far.
 *
 *   utility = exam score (66–96)
 *           + letter freshness   (0–36: letters not studied recently, or never)
 *           + alphabet spread    (0–8: far from letters already picked today)
 *           − same-letter penalty (45 per word already picked from that letter)
 *           − mix penalty        (when one part of speech / polarity is over-represented)
 *           + tiny per-day jitter (breaks ties differently each day)
 *
 * Unfinished words from the previous study day carry over first.
 */
import type { AppState, DayLog, Word } from '../types';
import { LETTERS, WORDS, WORD_BY_ID, letterOf } from './data';
import { daysBetween } from './dates';

/** Bump when the picker changes: today's not-yet-studied words are re-picked once. */
export const PICKER_VERSION = 2;

const FRESH_MAX = 36;
const FRESH_PER_CYCLE = 18;
const SPREAD_MAX = 8;
const SAME_LETTER_PENALTY = 45;
const MIX_PENALTY = 3;

const share = <K extends string>(key: (w: Word) => K): Record<K, number> => {
  const out = {} as Record<K, number>;
  for (const w of WORDS) out[key(w)] = (out[key(w)] ?? 0) + 1 / WORDS.length;
  return out;
};
const POS_SHARE = share((w) => w.pos);
const POL_SHARE = share((w) => w.polarity);

/** Deterministic 0–1 value per (day, word) so the same day always gives the same set. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

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

/** Days needed to touch every letter at the current pace. */
export function lettersCycleDays(target: number): number {
  return Math.ceil(26 / Math.max(1, Math.min(26, target)));
}

export function pickWords(opts: {
  count: number;
  exclude: Set<string>;
  letterLast: Record<string, string>;
  cards: AppState['cards'];
  today: string;
  /** Daily target, used for the letter-rotation pace. */
  target: number;
  /** Words already in today's set (counted for letter spread and the mix). */
  alreadyPicked?: string[];
  preferLetter?: string;
}): string[] {
  const { count, exclude, letterLast, cards, today, target, alreadyPicked = [], preferLetter } = opts;
  if (count <= 0) return [];

  let candidates = WORDS.filter((w) => !cards[w.id] && !exclude.has(w.id) && !alreadyPicked.includes(w.id));
  const cycle = lettersCycleDays(target);

  const picked: Word[] = [];
  const letterCount: Record<string, number> = {};
  const posCount: Record<string, number> = {};
  const polCount: Record<string, number> = {};
  const add = (w: Word) => {
    picked.push(w);
    letterCount[letterOf(w)] = (letterCount[letterOf(w)] ?? 0) + 1;
    posCount[w.pos] = (posCount[w.pos] ?? 0) + 1;
    polCount[w.polarity] = (polCount[w.polarity] ?? 0) + 1;
  };
  alreadyPicked.map((id) => WORD_BY_ID[id]).filter(Boolean).forEach(add);

  const freshness = (l: string) => {
    const last = letterLast[l];
    if (!last) return FRESH_MAX;
    const days = daysBetween(last, today);
    if (days <= 0) return 0;
    return Math.min(FRESH_MAX, (FRESH_PER_CYCLE * days) / cycle);
  };

  const utility = (w: Word): number => {
    const l = letterOf(w);
    const li = LETTERS.indexOf(l);
    let u = w.score + freshness(l);

    u -= SAME_LETTER_PENALTY * (letterCount[l] ?? 0);

    const used = Object.keys(letterCount).filter((x) => x !== l);
    if (used.length) {
      const minDist = Math.min(...used.map((x) => Math.abs(LETTERS.indexOf(x) - li)));
      u += (SPREAD_MAX * Math.min(minDist, 3)) / 3;
    } else {
      u += SPREAD_MAX;
    }

    const n = picked.length + 1;
    const posOver = (posCount[w.pos] ?? 0) + 1 - n * (POS_SHARE[w.pos] ?? 0);
    const polOver = (polCount[w.polarity] ?? 0) + 1 - n * (POL_SHARE[w.polarity] ?? 0);
    u -= MIX_PENALTY * Math.max(0, posOver - 0.5);
    u -= MIX_PENALTY * Math.max(0, polOver - 0.5);

    if (preferLetter && l === preferLetter) u += 100;
    return u + jitter(today + w.id) * 2;
  };

  const out: string[] = [];
  while (out.length < count && candidates.length) {
    let best = candidates[0];
    let bestU = -Infinity;
    for (const w of candidates) {
      const u = utility(w);
      if (u > bestU) {
        bestU = u;
        best = w;
      }
    }
    out.push(best.id);
    add(best);
    candidates = candidates.filter((w) => w.id !== best.id);
  }
  return out;
}

function emptyLog(words: string[], learned: string[], target: number, prev?: DayLog): DayLog {
  return {
    words,
    learned,
    target,
    practiceAnswered: prev?.practiceAnswered ?? 0,
    practiceCorrect: prev?.practiceCorrect ?? 0,
    reviewed: prev?.reviewed ?? 0,
    algo: PICKER_VERSION,
  };
}

/** Build today's list from scratch: today's learned words, then carry-over, then fresh picks. */
function buildDay(state: AppState, today: string, learned: string[], prev?: DayLog): DayLog {
  const target = state.settings.dailyTarget;
  const days = state.days;
  const prevKey = Object.keys(days)
    .filter((k) => k < today)
    .sort()
    .pop();
  const carry = prevKey
    ? days[prevKey].words
        .filter((id) => !days[prevKey].learned.includes(id) && !state.cards[id] && !learned.includes(id))
        .slice(0, Math.max(0, target - learned.length))
    : [];
  const base = [...learned, ...carry];
  const lettersBefore = letterLastTouched(
    Object.fromEntries(Object.entries(days).filter(([k]) => k < today)),
  );
  const fresh = pickWords({
    count: Math.max(0, target - base.length),
    exclude: new Set(base),
    letterLast: lettersBefore,
    cards: state.cards,
    today,
    target,
    alreadyPicked: base,
  });
  return emptyLog([...base, ...fresh], learned, target, prev);
}

/**
 * Makes sure today's log exists, uses the current picker and matches the daily target.
 * Returns the same state object when nothing changed.
 */
export function ensureToday(state: AppState, today: string): AppState {
  const target = state.settings.dailyTarget;
  const existing = state.days[today];

  if (!existing || existing.algo !== PICKER_VERSION) {
    // new day, or a list made by the old alphabetical picker: (re)build it, keeping
    // anything already learned today
    return { ...state, days: { ...state.days, [today]: buildDay(state, today, existing?.learned ?? [], existing) } };
  }

  if (existing.words.length === Math.max(target, existing.learned.length) && existing.target === target) {
    return state;
  }

  const log: DayLog = { ...existing, target };
  const need = Math.max(target, log.learned.length);
  if (log.words.length < need) {
    const more = pickWords({
      count: need - log.words.length,
      exclude: new Set(log.words),
      letterLast: letterLastTouched(state.days),
      cards: state.cards,
      today,
      target,
      alreadyPicked: log.words,
    });
    log.words = [...log.words, ...more];
  } else if (log.words.length > need) {
    // drop the lowest-scoring unlearned words; keep everything already learned
    const unlearned = log.words
      .filter((id) => !log.learned.includes(id))
      .sort((a, b) => (WORD_BY_ID[a]?.score ?? 0) - (WORD_BY_ID[b]?.score ?? 0));
    const remove = new Set(unlearned.slice(0, log.words.length - need));
    log.words = log.words.filter((id) => !remove.has(id));
  }
  if (log.words.length === existing.words.length && existing.target === target) {
    return state; // nothing left to add (word bank exhausted) — avoid re-render loops
  }
  return { ...state, days: { ...state.days, [today]: log } };
}

/** Swap a word the learner already knows for the next best pick (same letter if possible), in place. */
export function replaceWord(state: AppState, today: string, id: string): { state: AppState; replacement?: string } {
  const log = state.days[today];
  if (!log) return { state };
  const others = log.words.filter((w) => w !== id);
  const [replacement] = pickWords({
    count: 1,
    exclude: new Set(log.words),
    letterLast: letterLastTouched(state.days),
    cards: state.cards,
    today,
    target: state.settings.dailyTarget,
    alreadyPicked: others,
    preferLetter: id[0].toUpperCase(),
  });
  const words = replacement ? log.words.map((w) => (w === id ? replacement : w)) : others;
  return {
    state: { ...state, days: { ...state.days, [today]: { ...log, words } } },
    replacement,
  };
}

/** Summary of a day's mix, for the Home screen. */
export function dayMix(ids: string[]) {
  const ws = ids.map((id) => WORD_BY_ID[id]).filter(Boolean);
  const count = <K extends string>(key: (w: Word) => K) =>
    ws.reduce((acc, w) => ({ ...acc, [key(w)]: (acc[key(w)] ?? 0) + 1 }), {} as Record<K, number>);
  return {
    letters: new Set(ws.map(letterOf)).size,
    pos: count((w) => w.pos),
    polarity: count((w) => w.polarity),
    veryHigh: ws.filter((w) => w.tier >= 5).length,
  };
}
