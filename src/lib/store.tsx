import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState, Card, Rating, Settings } from '../types';
import { dateKey } from './dates';
import { ensureToday, replaceWord } from './daily';
import { newCard, reviewCard } from './fsrs';

const STORAGE_KEY = 'burki-vocab:v1';

export const DEFAULT_SETTINGS: Settings = {
  dailyTarget: 10,
  showUrdu: true,
  timed: false,
  timerSeconds: 30,
  onboarded: false,
};

function blankState(): AppState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, cards: {}, days: {}, stats: {}, bookmarks: [] };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed?.version !== 1) return blankState();
    return { ...blankState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return blankState();
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode / sandbox) — progress lives for this session only */
  }
}

function emptyDay(target: number) {
  return { words: [], learned: [], target, practiceAnswered: 0, practiceCorrect: 0, reviewed: 0 };
}

interface Store {
  state: AppState;
  today: string;
  setTarget: (n: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  learn: (id: string, rating: Rating) => void;
  markKnown: (id: string) => void;
  review: (id: string, rating: Rating) => void;
  recordAnswer: (id: string, correct: boolean) => void;
  toggleBookmark: (id: string) => void;
  resetAll: () => void;
  importState: (json: string) => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(() => dateKey());
  const [state, setState] = useState<AppState>(() => ensureToday(load(), dateKey()));

  // roll over at local midnight
  useEffect(() => {
    const t = setInterval(() => {
      const k = dateKey();
      setToday((prev) => (prev === k ? prev : k));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setState((s) => ensureToday(s, today));
  }, [today, state.settings.dailyTarget]);

  useEffect(() => {
    save(state);
  }, [state]);

  const setTarget = useCallback((n: number) => {
    const target = Math.max(1, Math.min(50, Math.round(n)));
    setState((s) => ensureToday({ ...s, settings: { ...s.settings, dailyTarget: target } }, dateKey()));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const learn = useCallback(
    (id: string, rating: Rating) => {
      setState((s) => {
        const cards = { ...s.cards };
        if (!cards[id] || cards[id].state === 'known') cards[id] = newCard(rating, today);
        const day = s.days[today] ?? emptyDay(s.settings.dailyTarget);
        const learned = rating === 1 || day.learned.includes(id) ? day.learned : [...day.learned, id];
        return { ...s, cards, days: { ...s.days, [today]: { ...day, learned } } };
      });
    },
    [today],
  );

  const markKnown = useCallback(
    (id: string) => {
      setState((s) => {
        const known: Card = { state: 'known', s: 60, d: 3, due: '9999-12-31', last: today, reps: 0, lapses: 0, learnedOn: today };
        const withCard = { ...s, cards: { ...s.cards, [id]: known } };
        return replaceWord(withCard, today, id).state;
      });
    },
    [today],
  );

  const review = useCallback(
    (id: string, rating: Rating) => {
      setState((s) => {
        const card = s.cards[id];
        if (!card) return s;
        const day = s.days[today] ?? emptyDay(s.settings.dailyTarget);
        return {
          ...s,
          cards: { ...s.cards, [id]: reviewCard(card, rating, today) },
          days: { ...s.days, [today]: { ...day, reviewed: day.reviewed + 1 } },
        };
      });
    },
    [today],
  );

  const recordAnswer = useCallback(
    (id: string, correct: boolean) => {
      setState((s) => {
        const st = s.stats[id] ?? { seen: 0, correct: 0 };
        const day = s.days[today] ?? emptyDay(s.settings.dailyTarget);
        return {
          ...s,
          stats: { ...s.stats, [id]: { seen: st.seen + 1, correct: st.correct + (correct ? 1 : 0) } },
          days: {
            ...s.days,
            [today]: { ...day, practiceAnswered: day.practiceAnswered + 1, practiceCorrect: day.practiceCorrect + (correct ? 1 : 0) },
          },
        };
      });
    },
    [today],
  );

  const toggleBookmark = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [...s.bookmarks, id],
    }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => ensureToday({ ...blankState(), settings: { ...s.settings } }, dateKey()));
  }, []);

  const importState = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (parsed?.version !== 1 || typeof parsed.cards !== 'object' || typeof parsed.days !== 'object') return false;
      setState(ensureToday({ ...blankState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }, dateKey()));
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<Store>(
    () => ({ state, today, setTarget, updateSettings, learn, markKnown, review, recordAnswer, toggleBookmark, resetAll, importState }),
    [state, today, setTarget, updateSettings, learn, markKnown, review, recordAnswer, toggleBookmark, resetAll, importState],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
