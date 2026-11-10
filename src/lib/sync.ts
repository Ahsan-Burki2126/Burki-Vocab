/**
 * Merging two copies of the learner's progress (this device + the cloud copy).
 *
 * Nothing is ever thrown away: you can study on your phone and your PC and both
 * sets of work survive.
 *  - Word cards: the copy reviewed most recently wins (then the one with more reviews).
 *  - Days: words and learned words are combined; practice/review counts take the larger.
 *    If two devices picked different lists for the same day, the combined list is
 *    trimmed back to the daily target later (learned words are always kept).
 *  - Practice stats: the copy with more answers wins.
 *  - Bookmarks: combined.
 *  - Settings: from whichever copy changed most recently.
 */
import type { AppState, Card, DayLog, WordStat } from '../types';

function pickCard(a?: Card, b?: Card): Card | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.last !== b.last) return a.last > b.last ? a : b;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  return a;
}

const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];

function mergeDay(a?: DayLog, b?: DayLog): DayLog | undefined {
  if (!a) return b;
  if (!b) return a;
  const practice = a.practiceAnswered >= b.practiceAnswered ? a : b;
  const algo = Math.max(a.algo ?? 0, b.algo ?? 0);
  const learned = union(a.learned, b.learned);
  return {
    // learned words first, so trimming to the target never drops them
    words: union(learned, union(a.words, b.words)),
    learned,
    target: Math.max(a.target, b.target),
    practiceAnswered: practice.practiceAnswered,
    practiceCorrect: practice.practiceCorrect,
    reviewed: Math.max(a.reviewed, b.reviewed),
    ...(algo ? { algo } : {}),
  };
}

function pickStat(a?: WordStat, b?: WordStat): WordStat | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.seen > a.seen ? b : a;
}

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, pick: (x?: T, y?: T) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const v = pick(a[k], b[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Merge `primary` (usually the cloud copy) with `secondary` (this device). */
export function mergeStates(primary: AppState, secondary: AppState): AppState {
  const newer = (secondary.updatedAt ?? 0) > (primary.updatedAt ?? 0) ? secondary : primary;
  return {
    version: 1,
    settings: { ...primary.settings, ...newer.settings },
    cards: mergeRecord(primary.cards ?? {}, secondary.cards ?? {}, pickCard),
    days: mergeRecord(primary.days ?? {}, secondary.days ?? {}, mergeDay),
    stats: mergeRecord(primary.stats ?? {}, secondary.stats ?? {}, pickStat),
    bookmarks: union(primary.bookmarks ?? [], secondary.bookmarks ?? []),
    updatedAt: Math.max(primary.updatedAt ?? 0, secondary.updatedAt ?? 0),
  };
}

/** Stable fingerprint of the synced content (ignores the timestamp). */
export function signature(s: AppState): string {
  return JSON.stringify({ ...s, updatedAt: 0 });
}

/** True when a state holds no study activity yet (a brand-new device). */
export function isPristine(s: AppState): boolean {
  return (
    Object.keys(s.cards).length === 0 &&
    Object.keys(s.stats).length === 0 &&
    Object.values(s.days).every((d) => d.learned.length === 0 && d.reviewed === 0 && d.practiceAnswered === 0)
  );
}
