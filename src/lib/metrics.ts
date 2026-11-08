import type { AppState } from '../types';
import { LETTERS, TOTAL_SCORE, WORDS, WORDS_BY_LETTER, WORD_BY_ID } from './data';
import { addDays } from './dates';
import { MASTERED_STABILITY, currentRetention } from './fsrs';

const active = (state: AppState, key: string) => {
  const d = state.days[key];
  return !!d && (d.learned.length > 0 || d.reviewed > 0 || d.practiceAnswered > 0);
};

export function streak(state: AppState, today: string): number {
  let n = 0;
  let key = active(state, today) ? today : addDays(today, -1);
  while (active(state, key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function dueIds(state: AppState, today: string): string[] {
  const todays = new Set(state.days[today]?.learned ?? []);
  return Object.entries(state.cards)
    .filter(([id, c]) => c.state === 'review' && c.due <= today && !todays.has(id) && WORD_BY_ID[id])
    .sort(([, a], [, b]) => (a.due === b.due ? currentRetention(a, today) - currentRetention(b, today) : a.due < b.due ? -1 : 1))
    .map(([id]) => id);
}

export function nextDue(state: AppState, today: string): string | null {
  const dues = Object.values(state.cards)
    .filter((c) => c.state === 'review' && c.due > today)
    .map((c) => c.due)
    .sort();
  return dues[0] ?? null;
}

export function counts(state: AppState) {
  let learned = 0;
  let known = 0;
  let mastered = 0;
  for (const c of Object.values(state.cards)) {
    if (c.state === 'known') known++;
    else {
      learned++;
      if (c.s >= MASTERED_STABILITY) mastered++;
    }
  }
  return { learned, known, mastered, total: WORDS.length, remaining: WORDS.length - learned - known };
}

/** Likelihood-weighted share of the word bank you'd currently recall. */
export function readiness(state: AppState, today: string): number {
  let got = 0;
  for (const w of WORDS) {
    const c = state.cards[w.id];
    if (!c) continue;
    const r = c.state === 'known' ? 0.95 : currentRetention(c, today);
    got += w.score * r;
  }
  return Math.round((got / TOTAL_SCORE) * 100);
}

export function letterCoverage(state: AppState) {
  return LETTERS.map((l) => {
    const all = WORDS_BY_LETTER[l];
    const done = all.filter((w) => state.cards[w.id]).length;
    return { letter: l, done, total: all.length };
  });
}

export function lastNDays(state: AppState, today: string, n: number) {
  const out: { key: string; learned: number; reviewed: number; answered: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    const d = state.days[key];
    out.push({ key, learned: d?.learned.length ?? 0, reviewed: d?.reviewed ?? 0, answered: d?.practiceAnswered ?? 0 });
  }
  return out;
}

export function weakWords(state: AppState, limit = 8): string[] {
  return Object.keys(state.cards)
    .filter((id) => state.cards[id].state === 'review' && WORD_BY_ID[id])
    .map((id) => {
      const st = state.stats[id];
      const acc = st && st.seen ? st.correct / st.seen : 1;
      const lapses = state.cards[id].lapses;
      return { id, weight: (1 - acc) * 2 + lapses * 0.6 };
    })
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((x) => x.id);
}

export function accuracy(state: AppState): { answered: number; correct: number } {
  let answered = 0;
  let correct = 0;
  for (const d of Object.values(state.days)) {
    answered += d.practiceAnswered;
    correct += d.practiceCorrect;
  }
  return { answered, correct };
}
