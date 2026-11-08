# Burki Vocab — NPFTAS Vocabulary Trainer

A daily vocabulary trainer for NPFTAS computer-based tests (Islamabad Police, NCCIA, FIA) and other Pakistani competitive exams (FPSC, PPSC, NTS). Built on the Lexora design system.

## What's inside

- **317 words**: 222 from the NPFTAS *Vocabulary with Memory Hooks* list, plus 95 extra high-frequency exam words, so every letter A–Z is covered.
- Each word has a **mnemonic (memory hook)**, meaning with a +/−/neutral mark, **Urdu meaning**, synonyms, antonyms, an example sentence and an exam-likelihood rating.
- **Daily target**: choose how many new words a day (5–50). Each day the app picks the highest-likelihood unlearned word from as many *different letters* as the target allows, and rotates letters so the whole alphabet gets covered (every 3 days at 10/day). Unfinished words carry over to the next day.
- **Learn**: one word at a time. Recall it first, then reveal. There's an optional mnemonic hint, and "I already know this" swaps a word out.
- **Practice (today's words only)**: synonym, antonym, sentence-completion and meaning questions. Synonym questions always include the antonym as a trap, like the real CBT. Optional timer (15–60 s).
- **Review**: spaced repetition with the FSRS-4.5 algorithm (Again / Hard / Good / Easy).
- **Progress**: mastery, A–Z coverage, a 14-day activity chart, weak words, likelihood-weighted exam readiness, and export/import of your progress.
- **Exam toolkit**: roots and prefixes, sentence connectors, and 30 confusable pairs with a drill.
- Works offline after the first visit and can be installed on a phone's home screen (PWA).

Progress is saved in the browser's localStorage. No account or backend is needed.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # logic checks (daily picker, quiz traps, FSRS)
npm run build      # production build in dist/
```

## Deploy to Vercel

**Option A — GitHub (recommended)**
1. Push this folder to a new GitHub repository.
2. On vercel.com choose **Add New → Project** and import the repo.
3. Vercel detects Vite automatically (build `npm run build`, output `dist`). Click **Deploy**.

**Option B — CLI**
```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

`vercel.json` is included. It sets caching headers for the service worker and the hashed assets. The app uses hash routes (`#/learn`), so no rewrite rules are needed.

## Editing the word list

The words live in `src/data/words.json`. Each entry looks like this:

```json
{
  "id": "abate", "word": "Abate", "pos": "v",
  "meaning": "to lessen", "polarity": "n",
  "hook": "A + BEAT — the storm is beaten down, so it dies down",
  "synonyms": ["subside", "diminish"], "antonyms": ["intensify"],
  "urdu": "کم ہونا، تھم جانا",
  "example": "The storm began to abate by evening.",
  "tier": 5, "score": 96, "source": "pdf"
}
```

- `polarity`: `+` positive, `-` negative, `n` neutral.
- `tier` (3–5) and `score` (0–100) control how early a word gets picked. A higher score is picked sooner within its letter.
- The example sentence must contain the word (or a form of it like *abated*) so the fill-in-the-blank questions work. Run `npm test` after editing to check.

Exam-likelihood ratings are estimates based on how often words recur in past Pakistani competitive-test papers. They are not official NPFTAS figures.

## Project structure

```
src/
  data/        words.json, toolkit.json
  lib/         daily.ts (word picker), fsrs.ts, quiz.ts, store.tsx, metrics.ts
  screens/     Home, Learn, Practice, Review, Progress, Library, Toolkit
  components/  shared word card parts, modal, icons
public/        manifest, service worker, icons
tests/         logic.ts
```
"# Burki-Vocab" 
