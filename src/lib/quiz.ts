/**
 * Practice question generator. Distractors are chosen to mimic real CBT traps:
 * a synonym question always hides the antonym among the options (and vice versa),
 * because that is the option half-learners pick.
 */
import type { Word } from '../types';
import { POLARITY_LABEL, WORDS, WORD_BY_ID } from './data';

export type QType = 'synonym' | 'antonym' | 'meaning' | 'reverse' | 'blank' | 'polarity';
export type PracticeMode = 'mixed' | 'synonym' | 'antonym' | 'meaning' | 'blank';

export interface Option {
  text: string;
  trap?: 'antonym' | 'synonym';
}

export interface Question {
  key: string;
  wordId: string;
  type: QType;
  prompt: string;
  /** For fill-in-the-blank */
  sentence?: { before: string; after: string };
  options: Option[];
  answer: number;
}

export const QTYPE_LABEL: Record<QType, string> = {
  synonym: 'Synonym',
  antonym: 'Antonym',
  meaning: 'Meaning',
  reverse: 'Which word?',
  blank: 'Sentence completion',
  polarity: 'Positive or negative?',
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const lower = (s: string) => s.toLowerCase();

/** True when two words mean roughly the same thing (so one can't be a distractor for the other). */
function similar(a: Word, b: Word): boolean {
  if (a.id === b.id) return true;
  const as = a.synonyms.map(lower);
  const bs = b.synonyms.map(lower);
  if (as.includes(lower(b.word)) || bs.includes(lower(a.word))) return true;
  if (as.some((x) => bs.includes(x))) return true;
  const aa = a.antonyms.map(lower);
  const ba = b.antonyms.map(lower);
  if (aa.some((x) => ba.includes(x))) return true;
  return lower(a.meaning) === lower(b.meaning);
}

function others(w: Word, filter: (o: Word) => boolean): Word[] {
  return shuffle(WORDS.filter((o) => !similar(w, o) && filter(o)));
}

function oppositePolarity(w: Word, o: Word): boolean {
  if (w.polarity === 'n') return true;
  return o.polarity !== w.polarity && o.polarity !== 'n';
}

/** Collect `n` unique option texts that are not in `banned`. */
function collect(n: number, candidates: string[], banned: Set<string>): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    const k = lower(c);
    if (banned.has(k)) continue;
    banned.add(k);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function blankSentence(w: Word): { before: string; after: string } | null {
  const base = lower(w.word);
  const stems = [base, base.slice(0, -1), base.slice(0, -2)].filter((s) => s.length >= 3);
  for (const stem of stems) {
    const re = new RegExp(`\\b${stem}[a-z]*`, 'i');
    const m = re.exec(w.example);
    if (m) {
      return { before: w.example.slice(0, m.index), after: w.example.slice(m.index + m[0].length) };
    }
  }
  return null;
}

function finish(w: Word, type: QType, prompt: string, correct: Option, wrong: Option[], extra: Partial<Question> = {}): Question {
  const options = shuffle([correct, ...wrong]);
  return {
    key: `${w.id}-${type}-${Math.random().toString(36).slice(2, 8)}`,
    wordId: w.id,
    type,
    prompt,
    options,
    answer: options.indexOf(correct),
    ...extra,
  };
}

export function makeQuestion(w: Word, type: QType): Question | null {
  switch (type) {
    case 'synonym': {
      const correct = pickOne(w.synonyms);
      const trap = w.antonyms[0];
      const banned = new Set([...w.synonyms, ...w.antonyms, w.word].map(lower));
      const pool = others(w, (o) => oppositePolarity(w, o)).flatMap((o) => o.synonyms);
      const wrong = collect(2, shuffle(pool), banned);
      if (wrong.length < 2) return null;
      return finish(w, type, `Choose the word closest in meaning to`, { text: correct }, [
        { text: trap, trap: 'antonym' },
        ...wrong.map((text) => ({ text })),
      ]);
    }
    case 'antonym': {
      const correct = pickOne(w.antonyms);
      const trap = w.synonyms[0];
      const banned = new Set([...w.synonyms, ...w.antonyms, w.word].map(lower));
      const pool = others(w, (o) => o.polarity === w.polarity).flatMap((o) => o.synonyms);
      const wrong = collect(2, shuffle(pool), banned);
      if (wrong.length < 2) return null;
      return finish(w, type, `Choose the word most OPPOSITE in meaning to`, { text: correct }, [
        { text: trap, trap: 'synonym' },
        ...wrong.map((text) => ({ text })),
      ]);
    }
    case 'meaning': {
      const banned = new Set([lower(w.meaning)]);
      const pool = others(w, (o) => o.pos === w.pos).map((o) => o.meaning);
      const wrong = collect(3, pool, banned);
      if (wrong.length < 3) return null;
      return finish(w, type, `What does this word mean?`, { text: w.meaning }, wrong.map((text) => ({ text })));
    }
    case 'reverse': {
      const banned = new Set([lower(w.word)]);
      const pool = others(w, (o) => o.pos === w.pos).map((o) => o.word);
      const wrong = collect(3, pool, banned);
      if (wrong.length < 3) return null;
      return finish(w, type, `Which word means “${w.meaning}”?`, { text: w.word }, wrong.map((text) => ({ text })));
    }
    case 'blank': {
      const sentence = blankSentence(w);
      if (!sentence) return null;
      const banned = new Set([lower(w.word)]);
      const pool = others(w, (o) => o.pos === w.pos && oppositePolarity(w, o)).map((o) => o.word);
      const fallback = others(w, (o) => o.pos === w.pos).map((o) => o.word);
      const wrong = collect(3, [...pool, ...fallback], banned);
      if (wrong.length < 3) return null;
      return finish(w, type, `Choose the word that best completes the sentence (any form).`, { text: w.word }, wrong.map((text) => ({ text })), {
        sentence,
      });
    }
    case 'polarity': {
      const labels: Word['polarity'][] = ['+', '-', 'n'];
      const correct = { text: POLARITY_LABEL[w.polarity] };
      const wrong = labels.filter((p) => p !== w.polarity).map((p) => ({ text: POLARITY_LABEL[p] }));
      const q = finish(w, type, `Is this word positive, negative or neutral?`, correct, wrong);
      // keep a fixed order for polarity so it reads naturally
      const fixed = labels.map((p) => q.options.find((o) => o.text === POLARITY_LABEL[p])!);
      return { ...q, options: fixed, answer: fixed.findIndex((o) => o.text === correct.text) };
    }
  }
}

/** Mixed mode: every word gets one synonym-or-antonym question (the most common CBT
 *  vocabulary format) plus one of sentence completion / meaning / reverse. */
function mixedTypes(): QType[] {
  const first: QType = Math.random() < 0.5 ? 'synonym' : 'antonym';
  const second = first === 'synonym' ? 'antonym' : 'synonym';
  return [first, ...shuffle<QType>(['blank', 'meaning', 'reverse', second]), 'polarity'];
}

export function buildSession(wordIds: string[], mode: PracticeMode, perWord = 2): Question[] {
  const words = wordIds.map((id) => WORD_BY_ID[id]).filter(Boolean);
  const qs: Question[] = [];
  for (const w of words) {
    const types: QType[] =
      mode === 'mixed'
        ? mixedTypes()
        : mode === 'meaning'
          ? shuffle(['meaning', 'reverse'] as QType[])
          : [mode as QType, mode as QType];
    let made = 0;
    for (const t of types) {
      if (made >= perWord) break;
      const q = makeQuestion(w, t);
      if (q) {
        qs.push(q);
        made++;
      }
    }
  }
  // shuffle, then nudge apart questions on the same word
  const out = shuffle(qs);
  for (let i = 1; i < out.length; i++) {
    if (out[i].wordId === out[i - 1].wordId) {
      const j = out.findIndex((q, k) => k > i && q.wordId !== out[i - 1].wordId);
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
