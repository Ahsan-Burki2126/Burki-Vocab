/**
 * Compact FSRS-4.5 scheduler (Free Spaced Repetition Scheduler) with the published
 * default parameters. Intervals depend on each word's stability and difficulty,
 * not on fixed 1-3-7 day steps.
 */
import type { Card, Rating } from '../types';
import { addDays, daysBetween } from './dates';

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793,
  0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;
const MAX_INTERVAL = 365;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function retrievability(elapsedDays: number, s: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / s, DECAY);
}

export function intervalFor(s: number): number {
  const raw = (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, MAX_INTERVAL);
}

const initDifficulty = (g: Rating) => clamp(W[4] - (g - 3) * W[5], 1, 10);
const initStability = (g: Rating) => W[g - 1];

function nextDifficulty(d: number, g: Rating): number {
  const next = d - W[6] * (g - 3);
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * next, 1, 10);
}

function recallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
}

function forgetStability(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return Math.min(sf, s);
}

/** First time a word is learned (Learn screen). */
export function newCard(g: Rating, today: string): Card {
  const s = initStability(g);
  return {
    state: 'review',
    s,
    d: initDifficulty(g),
    due: addDays(today, intervalFor(s)),
    last: today,
    reps: 1,
    lapses: g === 1 ? 1 : 0,
    learnedOn: today,
  };
}

/** A scheduled review (Review screen). */
export function reviewCard(card: Card, g: Rating, today: string): Card {
  const elapsed = daysBetween(card.last, today);
  const r = retrievability(elapsed, card.s);
  const d = nextDifficulty(card.d, g);
  const s = g === 1 ? forgetStability(card.d, card.s, r) : recallStability(card.d, card.s, r, g);
  const interval = g === 1 ? 1 : intervalFor(s);
  return {
    ...card,
    s,
    d,
    due: addDays(today, interval),
    last: today,
    reps: card.reps + 1,
    lapses: card.lapses + (g === 1 ? 1 : 0),
  };
}

/** Interval (days) each button would give — shown on the rating buttons. */
export function previewIntervals(card: Card | undefined, today: string): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  ([1, 2, 3, 4] as Rating[]).forEach((g) => {
    const next = card ? reviewCard(card, g, today) : newCard(g, today);
    out[g] = daysBetween(today, next.due);
  });
  return out;
}

export function currentRetention(card: Card, today: string): number {
  return retrievability(daysBetween(card.last, today), card.s);
}

export const MASTERED_STABILITY = 21;
