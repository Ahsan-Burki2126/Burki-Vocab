import wordsJson from '../data/words.json';
import toolkitJson from '../data/toolkit.json';
import type { Toolkit, Word } from '../types';

export const WORDS = wordsJson as Word[];
export const TOOLKIT = toolkitJson as Toolkit;

export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(WORDS.map((w) => [w.id, w]));

/** Lowercase headword -> id, used to link synonyms/antonyms into a word network. */
const BY_HEADWORD: Record<string, string> = Object.fromEntries(WORDS.map((w) => [w.word.toLowerCase(), w.id]));

export function linkedId(term: string): string | undefined {
  return BY_HEADWORD[term.trim().toLowerCase()];
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const letterOf = (w: Word) => w.word[0].toUpperCase();

export const WORDS_BY_LETTER: Record<string, Word[]> = Object.fromEntries(
  LETTERS.map((l) => [l, WORDS.filter((w) => letterOf(w) === l)]),
);

export const POS_LABEL: Record<Word['pos'], string> = {
  adj: 'Adjective',
  v: 'Verb',
  n: 'Noun',
  adv: 'Adverb',
};

export const POLARITY_LABEL: Record<Word['polarity'], string> = {
  '+': 'Positive',
  '-': 'Negative',
  n: 'Neutral',
};

export function likelihoodLabel(w: Word): string {
  if (w.tier >= 5) return 'Very high';
  if (w.tier === 4) return 'High';
  return 'Moderate';
}

export const TOTAL_SCORE = WORDS.reduce((a, w) => a + w.score, 0);
