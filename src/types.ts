export type Polarity = '+' | '-' | 'n';
export type Pos = 'adj' | 'v' | 'n' | 'adv';

export interface Word {
  id: string;
  word: string;
  pos: Pos;
  meaning: string;
  polarity: Polarity;
  hook: string;
  synonyms: string[];
  antonyms: string[];
  urdu: string;
  example: string;
  /** 3–5: how often this word recurs in Pakistani competitive-test papers (5 = very often). */
  tier: number;
  /** 0–100 exam-likelihood score used to rank the daily picks. */
  score: number;
  source: 'pdf' | 'extra';
}

/** 1 Again · 2 Hard · 3 Good · 4 Easy */
export type Rating = 1 | 2 | 3 | 4;

export interface Card {
  state: 'review' | 'known';
  /** FSRS stability in days */
  s: number;
  /** FSRS difficulty 1–10 */
  d: number;
  due: string; // YYYY-MM-DD
  last: string; // YYYY-MM-DD
  reps: number;
  lapses: number;
  learnedOn: string;
}

export interface DayLog {
  words: string[];
  learned: string[];
  target: number;
  practiceAnswered: number;
  practiceCorrect: number;
  reviewed: number;
  /** Version of the daily picker that built this list (see PICKER_VERSION). */
  algo?: number;
}

export interface WordStat {
  seen: number;
  correct: number;
}

export interface Settings {
  dailyTarget: number;
  showUrdu: boolean;
  timed: boolean;
  timerSeconds: number;
  onboarded: boolean;
}

export interface AppState {
  version: 1;
  settings: Settings;
  cards: Record<string, Card>;
  days: Record<string, DayLog>;
  stats: Record<string, WordStat>;
  bookmarks: string[];
}

export interface Prefix {
  part: string;
  meaning: string;
  examples: string;
}
export interface Connector {
  direction: string;
  words: string;
  rule: string;
}
export interface Confusable {
  pair: string;
  difference: string;
  hook: string;
  options: string[];
  sentence: string;
  answer: string;
}
export interface Toolkit {
  prefixes: Prefix[];
  roots: Prefix[];
  connectors: Connector[];
  confusables: Confusable[];
}
