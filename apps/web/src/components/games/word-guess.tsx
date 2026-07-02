'use client';

import * as React from 'react';
import { Delete, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A small offline word list — the answer is drawn from here; any 5-letter
// guess is accepted so a limited dictionary never blocks a real word.
const WORDS = [
  'APPLE', 'BRAVE', 'CRANE', 'DREAM', 'EAGLE', 'FLAME', 'GRAPE', 'HOUSE', 'IVORY', 'JOLLY',
  'KNEEL', 'LEMON', 'MANGO', 'NOBLE', 'OCEAN', 'PIANO', 'QUERY', 'RIVER', 'STONE', 'TIGER',
  'UNITY', 'VIVID', 'WATER', 'XENON', 'YACHT', 'ZEBRA', 'PLANT', 'SMILE', 'CLOUD', 'BEACH',
  'LIGHT', 'MUSIC', 'HEART', 'EARTH', 'SUGAR', 'HONEY', 'CHAIR', 'TABLE', 'GLASS', 'BREAD',
  'PEARL', 'ROBOT', 'SPACE', 'STORM', 'FROST', 'GHOST', 'MAGIC', 'PRIZE', 'QUEEN', 'ROYAL',
];

const ROWS = 6;
const LEN = 5;

type LS = 'correct' | 'present' | 'absent';

const pickWord = () => WORDS[Math.floor(Math.random() * WORDS.length)]!;

/** Wordle-style scoring with correct duplicate-letter handling. */
function scoreGuess(guess: string, answer: string): LS[] {
  const res: LS[] = Array<LS>(LEN).fill('absent');
  const counts = new Map<string, number>();
  for (const ch of answer) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  // First pass: exact positions.
  for (let i = 0; i < LEN; i++) {
    const g = guess.charAt(i);
    if (g === answer.charAt(i)) {
      res[i] = 'correct';
      counts.set(g, (counts.get(g) ?? 0) - 1);
    }
  }
  // Second pass: present-elsewhere.
  for (let i = 0; i < LEN; i++) {
    if (res[i] === 'correct') continue;
    const g = guess.charAt(i);
    if ((counts.get(g) ?? 0) > 0) {
      res[i] = 'present';
      counts.set(g, (counts.get(g) ?? 0) - 1);
    }
  }
  return res;
}

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const TILE_CLASS: Record<LS, string> = {
  correct: 'bg-emerald-500 border-emerald-500 text-white',
  present: 'bg-amber-500 border-amber-500 text-white',
  absent: 'bg-muted-foreground/40 border-muted-foreground/40 text-white',
};

export function WordGuess() {
  const [answer, setAnswer] = React.useState<string>(pickWord);
  const [guesses, setGuesses] = React.useState<string[]>([]);
  const [current, setCurrent] = React.useState('');
  const [shake, setShake] = React.useState(false);

  const won = guesses.includes(answer);
  const lost = !won && guesses.length >= ROWS;
  const done = won || lost;

  // Keyboard letter colors merged across all guesses (correct > present > absent).
  const keyState = React.useMemo(() => {
    const map: Record<string, LS> = {};
    const rank: Record<LS, number> = { absent: 0, present: 1, correct: 2 };
    for (const g of guesses) {
      const sc = scoreGuess(g, answer);
      for (let i = 0; i < LEN; i++) {
        const ch = g.charAt(i);
        const s = sc[i]!;
        const prev = map[ch];
        if (prev === undefined || rank[s] > rank[prev]) map[ch] = s;
      }
    }
    return map;
  }, [guesses, answer]);

  const submit = React.useCallback(() => {
    if (done) return;
    if (current.length !== LEN) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    setGuesses((g) => [...g, current]);
    setCurrent('');
  }, [current, done]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === 'Enter') {
        submit();
      } else if (e.key === 'Backspace') {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setCurrent((c) => (c.length < LEN ? c + e.key.toUpperCase() : c));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, done]);

  const tapKey = (k: string) => {
    if (done) return;
    if (k === 'ENTER') submit();
    else if (k === 'DEL') setCurrent((c) => c.slice(0, -1));
    else setCurrent((c) => (c.length < LEN ? c + k : c));
  };

  const reset = () => {
    setAnswer(pickWord());
    setGuesses([]);
    setCurrent('');
    setShake(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-semibold">
        {won ? 'You got it! 🎉' : lost ? `Out of tries — it was ${answer}` : `Guess the word · ${guesses.length}/${ROWS}`}
      </div>

      <div className="grid grid-rows-6 gap-1.5">
        {Array.from({ length: ROWS }, (_, r) => {
          const submitted = r < guesses.length;
          const isCurrent = r === guesses.length && !done;
          const word = submitted ? guesses[r]! : isCurrent ? current : '';
          const score = submitted ? scoreGuess(word, answer) : null;
          return (
            <div key={r} className={cn('grid grid-cols-5 gap-1.5', isCurrent && shake && 'animate-shake')}>
              {Array.from({ length: LEN }, (_, c) => {
                const ch = word.charAt(c);
                const ls = score?.[c];
                return (
                  <div
                    key={c}
                    className={cn(
                      'flex size-12 items-center justify-center rounded border-2 text-2xl font-bold uppercase',
                      ls ? TILE_CLASS[ls] : ch ? 'border-foreground/40' : 'border-border',
                    )}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {ri === 2 && (
              <button
                onClick={() => tapKey('ENTER')}
                disabled={done}
                className="flex h-10 items-center rounded bg-muted px-2 text-xs font-bold uppercase transition hover:bg-accent disabled:opacity-50"
              >
                Enter
              </button>
            )}
            {row.split('').map((k) => {
              const st = keyState[k];
              return (
                <button
                  key={k}
                  onClick={() => tapKey(k)}
                  disabled={done}
                  className={cn(
                    'h-10 w-7 rounded text-sm font-bold uppercase transition disabled:opacity-50 sm:w-8',
                    st ? TILE_CLASS[st] : 'bg-muted hover:bg-accent',
                  )}
                >
                  {k}
                </button>
              );
            })}
            {ri === 2 && (
              <button
                onClick={() => tapKey('DEL')}
                disabled={done}
                className="flex h-10 items-center rounded bg-muted px-2 transition hover:bg-accent disabled:opacity-50"
                aria-label="Delete"
              >
                <Delete className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Button variant="secondary" size="sm" onClick={reset}>
        <RotateCcw className="size-4" /> New word
      </Button>

      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <p>Guess the 5-letter word in 6 tries — type letters, then press Enter.</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm bg-emerald-500" /> right spot
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm bg-amber-500" /> wrong spot
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded-sm bg-muted-foreground/40" /> not in word
          </span>
        </div>
      </div>
    </div>
  );
}
