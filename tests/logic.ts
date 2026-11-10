/* Logic checks for the daily picker, quiz generator and FSRS scheduler.
   Run: npm test   (bundles with esbuild, runs in Node) */
import type { AppState, Rating } from '../src/types';
import { WORDS, WORD_BY_ID, LETTERS } from '../src/lib/data';
import { dayMix, ensureToday, replaceWord } from '../src/lib/daily';
import { addDays } from '../src/lib/dates';
import { newCard, reviewCard, previewIntervals } from '../src/lib/fsrs';
import { buildSession, makeQuestion, blankSentence, type QType } from '../src/lib/quiz';

let failures = 0;
const check = (cond: unknown, msg: string) => {
  if (!cond) {
    failures++;
    console.error('  ✗ ' + msg);
  }
};

const blank = (target: number): AppState => ({
  version: 1,
  settings: { dailyTarget: target, showUrdu: true, timed: false, timerSeconds: 30, onboarded: true },
  cards: {},
  days: {},
  stats: {},
  bookmarks: [],
});

// ---------- 1. Daily picker over 32 days at 10/day ----------
console.log('Daily picker (10/day, learn everything each day)');
{
  let s = blank(10);
  let day = '2026-11-08';
  const touched = new Set<string>();
  let allLettersBy = -1;
  const longestRun = (letters: string[]) => {
    const idx = Array.from(new Set(letters)).map((l) => LETTERS.indexOf(l)).sort((a, b) => a - b);
    let best = idx.length ? 1 : 0;
    let run = 1;
    for (let i = 1; i < idx.length; i++) {
      run = idx[i] === idx[i - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return best;
  };
  for (let i = 0; i < 32; i++) {
    s = ensureToday(s, day);
    const log = s.days[day];
    const words = log.words;
    check(log.algo === 2, `day ${i + 1}: built by picker v2`);
    const letters = words.map((id) => id[0].toUpperCase());
    const distinct = new Set(letters);
    const remainingLetters = new Set(WORDS.filter((w) => !s.cards[w.id]).map((w) => w.word[0].toUpperCase()));
    check(words.length === Math.min(10, WORDS.length - Object.keys(s.cards).length), `day ${i + 1}: picked ${words.length}`);
    check(distinct.size === Math.min(words.length, remainingLetters.size), `day ${i + 1}: ${distinct.size} distinct letters of ${words.length} (remaining letters ${remainingLetters.size})`);
    // quality: each pick is within one likelihood tier (12 pts) of the best word left in its letter
    for (const id of words) {
      const l = id[0].toUpperCase();
      const best = Math.max(...WORDS.filter((w) => !s.cards[w.id] && w.word[0].toUpperCase() === l).map((w) => w.score));
      check(WORD_BY_ID[id].score >= best - 12, `day ${i + 1} ${WORD_BY_ID[id].word}: score ${WORD_BY_ID[id].score} vs best ${best} in ${l}`);
    }
    if (remainingLetters.size >= 20) {
      check(longestRun(letters) <= 3, `day ${i + 1}: letters bunched (${[...distinct].sort().join('')})`);
    }
    if (i < 4) {
      const mix = dayMix(words);
      const sorted = [...words].sort();
      check(words.join() !== sorted.join(), `day ${i + 1}: study order is not alphabetical`);
      check(Object.keys(mix.pos).length >= 2 && Object.keys(mix.polarity).length >= 2, `day ${i + 1}: mixed word types`);
      console.log(
        `  day ${i + 1}: ${words.map((id) => WORD_BY_ID[id].word).join(', ')}\n` +
          `         letters ${[...distinct].sort().join('')} · avg score ${(words.reduce((a, id) => a + WORD_BY_ID[id].score, 0) / words.length).toFixed(1)}` +
          ` · ${JSON.stringify(mix.pos)} ${JSON.stringify(mix.polarity)}`,
      );
    }
    letters.forEach((l) => touched.add(l));
    if (allLettersBy < 0 && touched.size === 26) allLettersBy = i + 1;
    // learn them all
    for (const id of words) {
      s.cards[id] = newCard(3, day);
      s.days[day].learned.push(id);
    }
    day = addDays(day, 1);
  }
  console.log(`  all 26 letters touched by day ${allLettersBy}`);
  check(allLettersBy > 0 && allLettersBy <= 4, `expected all letters within 4 days, got ${allLettersBy}`);
  check(Object.keys(s.cards).length === WORDS.length, `bank exhausted after 32 days: ${Object.keys(s.cards).length}/${WORDS.length}`);
  check(ensureToday(blank(10), '2026-11-08').days['2026-11-08'].words.join() === ensureToday(blank(10), '2026-11-08').days['2026-11-08'].words.join(), 'same day → same picks (deterministic)');
}

// ---------- 2. Carry-over, target change, replace, migration ----------
console.log('Carry-over / target change / replace / migration');
{
  let s = blank(10);
  const d1 = '2026-11-08';
  s = ensureToday(s, d1);
  const first = s.days[d1].words.slice();
  // learn only 4
  for (const id of first.slice(0, 4)) {
    s.cards[id] = newCard(3, d1);
    s.days[d1].learned.push(id);
  }
  const d2 = addDays(d1, 1);
  s = ensureToday(s, d2);
  const carried = first.slice(4);
  check(carried.every((id) => s.days[d2].words.includes(id)), 'unfinished words carry over to next day');
  check(s.days[d2].words.length === 10, 'next day still has 10 words');

  // raise target to 15 mid-day
  s = ensureToday({ ...s, settings: { ...s.settings, dailyTarget: 15 } }, d2);
  check(s.days[d2].words.length === 15, `target raised to 15 → ${s.days[d2].words.length}`);
  // learn 3 then lower to 5 → keeps learned
  const toLearn = s.days[d2].words.slice(0, 3);
  for (const id of toLearn) {
    s.cards[id] = newCard(3, d2);
    s.days[d2].learned.push(id);
  }
  s = ensureToday({ ...s, settings: { ...s.settings, dailyTarget: 5 } }, d2);
  check(s.days[d2].words.length === 5, `target lowered to 5 → ${s.days[d2].words.length}`);
  check(toLearn.every((id) => s.days[d2].words.includes(id)), 'learned words survive target decrease');
  check(ensureToday(s, d2) === s, 'ensureToday is idempotent');

  // replace a known word — in place, same letter preferred
  const victim = s.days[d2].words.find((id) => !s.days[d2].learned.includes(id))!;
  const pos = s.days[d2].words.indexOf(victim);
  s.cards[victim] = { state: 'known', s: 60, d: 3, due: '9999-12-31', last: d2, reps: 0, lapses: 0, learnedOn: d2 };
  const res = replaceWord(s, d2, victim);
  check(!res.state.days[d2].words.includes(victim), 'known word removed from today');
  check(res.state.days[d2].words.length === 5, 'replacement keeps count');
  if (res.replacement) {
    check(res.state.days[d2].words[pos] === res.replacement, 'replacement takes the same slot');
    console.log(`  replaced ${WORD_BY_ID[victim].word} → ${WORD_BY_ID[res.replacement].word}`);
  }

  // migration: a list saved by the old alphabetical picker is re-picked, learned words kept
  const old = blank(10);
  const today = '2026-11-10';
  const oldWords = ['abate', 'benevolent', 'callous', 'deter', 'eloquent', 'frugal', 'gullible', 'haughty', 'imminent', 'jovial'];
  old.cards.abate = newCard(3, today);
  old.days[today] = { words: oldWords, learned: ['abate'], target: 10, practiceAnswered: 3, practiceCorrect: 2, reviewed: 0 };
  const migrated = ensureToday(old, today).days[today];
  check(migrated.algo === 2, 'old list migrated to picker v2');
  check(migrated.words[0] === 'abate' && migrated.learned.join() === 'abate', 'learned word kept first after migration');
  check(migrated.words.length === 10 && new Set(migrated.words.map((id) => id[0])).size === 10, 'migrated list has 10 distinct letters');
  check(migrated.practiceAnswered === 3, 'practice stats kept after migration');
  console.log(`  migrated: ${migrated.words.map((id) => WORD_BY_ID[id].word).join(', ')}`);
}

// ---------- 3. Quiz generation for every word ----------
console.log('Quiz questions for all words');
{
  const types: QType[] = ['synonym', 'antonym', 'meaning', 'reverse', 'blank', 'polarity'];
  const nulls: Record<string, string[]> = {};
  let made = 0;
  for (let round = 0; round < 3; round++) {
    for (const w of WORDS) {
      for (const t of types) {
        const q = makeQuestion(w, t);
        if (!q) {
          (nulls[t] ||= []).push(w.word);
          continue;
        }
        made++;
        const texts = q.options.map((o) => o.text.toLowerCase());
        check(new Set(texts).size === texts.length, `${w.word}/${t}: duplicate options ${texts}`);
        check(q.answer >= 0 && q.answer < q.options.length, `${w.word}/${t}: bad answer index`);
        const correct = q.options[q.answer].text;
        if (t === 'synonym') {
          check(w.synonyms.includes(correct), `${w.word}/synonym: answer ${correct}`);
          check(q.options.some((o) => o.trap === 'antonym'), `${w.word}/synonym: antonym trap present`);
          const wrong = q.options.filter((_, i) => i !== q.answer).map((o) => o.text.toLowerCase());
          check(!wrong.some((x) => w.synonyms.map((s) => s.toLowerCase()).includes(x)), `${w.word}/synonym: a wrong option is also a synonym`);
        }
        if (t === 'antonym') {
          check(w.antonyms.includes(correct), `${w.word}/antonym: answer ${correct}`);
          const wrong = q.options.filter((_, i) => i !== q.answer).map((o) => o.text.toLowerCase());
          check(!wrong.some((x) => w.antonyms.map((s) => s.toLowerCase()).includes(x)), `${w.word}/antonym: a wrong option is also an antonym`);
        }
        if (t === 'reverse' || t === 'blank') check(correct === w.word, `${w.word}/${t}: answer ${correct}`);
        if (t === 'meaning') check(correct === w.meaning, `${w.word}/meaning`);
      }
    }
  }
  console.log(`  ${made} questions generated`);
  for (const [t, list] of Object.entries(nulls)) console.log(`  could not build ${t} for: ${Array.from(new Set(list)).join(', ')}`);
  check(!nulls.synonym && !nulls.antonym && !nulls.blank, 'every word supports synonym, antonym and blank questions');
  const missingBlank = WORDS.filter((w) => !blankSentence(w)).map((w) => w.word);
  check(missingBlank.length === 0, `examples without findable word: ${missingBlank}`);

  const sess = buildSession(WORDS.slice(0, 10).map((w) => w.id), 'mixed');
  check(sess.length === 20, `mixed session of 10 words → ${sess.length} questions`);
  const perWordTypes = new Map<string, Set<QType>>();
  sess.forEach((q) => (perWordTypes.get(q.wordId) ?? perWordTypes.set(q.wordId, new Set()).get(q.wordId)!).add(q.type));
  check([...perWordTypes.values()].every((s) => s.size === 2 && (s.has('synonym') || s.has('antonym'))), 'each word gets a syn/ant question + one other type');
}

// ---------- 4. FSRS ----------
console.log('FSRS scheduling');
{
  const today = '2026-11-08';
  const p = previewIntervals(undefined, today);
  console.log(`  new card intervals Again/Hard/Good/Easy: ${p[1]}/${p[2]}/${p[3]}/${p[4]} days`);
  check(p[1] <= p[2] && p[2] <= p[3] && p[3] <= p[4], 'new intervals ordered');
  let c = newCard(3, today);
  let day = today;
  const seq: number[] = [];
  for (let i = 0; i < 6; i++) {
    day = c.due;
    c = reviewCard(c, 3 as Rating, day);
    seq.push(Math.round(c.s));
  }
  console.log(`  stability after 6 'Good' reviews: ${seq.join(' → ')}`);
  check(seq.every((v, i) => i === 0 || v > seq[i - 1]), 'stability grows with Good reviews');
  const lapsed = reviewCard(c, 1, c.due);
  check(lapsed.s < c.s && lapsed.lapses === c.lapses + 1, 'Again lowers stability and counts a lapse');
  const pr = previewIntervals(c, c.due);
  check(pr[1] <= pr[2] && pr[2] <= pr[3] && pr[3] <= pr[4], `review intervals ordered ${JSON.stringify(pr)}`);
}

// ---------- 5. Data sanity ----------
console.log('Data');
{
  const letters = new Set(WORDS.map((w) => w.word[0].toUpperCase()));
  check(LETTERS.every((l) => letters.has(l)), 'every letter A–Z has words');
  check(WORDS.every((w) => w.hook && w.hook.length > 5), 'every word has a mnemonic');
  check(WORDS.every((w) => w.urdu && w.example), 'every word has Urdu + example');
  console.log(`  ${WORDS.length} words, ${WORDS.filter((w) => w.source === 'pdf').length} from PDF`);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
