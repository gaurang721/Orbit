'use client';

import * as React from 'react';
import { Bomb, Flag, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const N = 9; // 9x9 board
const MINES = 10;

const idx = (r: number, c: number) => r * N + c;

function neighbors(i: number): number[] {
  const r = Math.floor(i / N);
  const c = i % N;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(idx(nr, nc));
    }
  }
  return out;
}

/** Place mines avoiding the first-clicked cell (and its neighbors) so the opening is fair. */
function placeMines(safe: number): Set<number> {
  const forbidden = new Set<number>([safe, ...neighbors(safe)]);
  const mines = new Set<number>();
  while (mines.size < MINES) {
    const cell = Math.floor(Math.random() * N * N);
    if (!forbidden.has(cell)) mines.add(cell);
  }
  return mines;
}

type Status = 'idle' | 'playing' | 'won' | 'lost';

export function Minesweeper() {
  const [mines, setMines] = React.useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = React.useState<boolean[]>(() => Array(N * N).fill(false));
  const [flags, setFlags] = React.useState<boolean[]>(() => Array(N * N).fill(false));
  const [status, setStatus] = React.useState<Status>('idle');
  const [flagMode, setFlagMode] = React.useState(false);

  const adjacent = React.useCallback(
    (i: number, mineSet: Set<number>) => neighbors(i).filter((n) => mineSet.has(n)).length,
    [],
  );

  const flagCount = flags.filter(Boolean).length;

  const reveal = (start: number) => {
    if (status === 'won' || status === 'lost' || revealed[start] || flags[start]) return;

    let mineSet = mines;
    if (status === 'idle') {
      mineSet = placeMines(start);
      setMines(mineSet);
      setStatus('playing');
    }

    if (flagMode) return; // in flag mode a tap flags instead (handled below)

    if (mineSet.has(start)) {
      // Boom — reveal every mine.
      const next = revealed.slice();
      mineSet.forEach((m) => (next[m] = true));
      next[start] = true;
      setRevealed(next);
      setStatus('lost');
      return;
    }

    // Flood-fill empty (zero-adjacent) regions.
    const next = revealed.slice();
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      if (next[cur] || flags[cur]) continue;
      next[cur] = true;
      if (adjacent(cur, mineSet) === 0) {
        for (const nb of neighbors(cur)) if (!next[nb] && !mineSet.has(nb)) stack.push(nb);
      }
    }
    setRevealed(next);

    const safeCells = N * N - mineSet.size;
    const openCount = next.filter(Boolean).length;
    if (openCount === safeCells) setStatus('won');
  };

  const toggleFlag = (i: number) => {
    if (status === 'won' || status === 'lost' || revealed[i]) return;
    setFlags((f) => {
      const next = f.slice();
      next[i] = !next[i];
      return next;
    });
  };

  const onCellClick = (i: number) => {
    if (flagMode) toggleFlag(i);
    else reveal(i);
  };

  const reset = () => {
    setMines(new Set());
    setRevealed(Array(N * N).fill(false));
    setFlags(Array(N * N).fill(false));
    setStatus('idle');
    setFlagMode(false);
  };

  const numberColor = ['', 'text-blue-500', 'text-emerald-600', 'text-rose-500', 'text-indigo-600', 'text-amber-600', 'text-cyan-600', 'text-foreground', 'text-muted-foreground'];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm font-semibold">
          <Bomb className="size-4" /> {Math.max(0, MINES - flagCount)}
        </div>
        <div className="text-sm font-bold">
          {status === 'won' ? 'Cleared! 🎉' : status === 'lost' ? 'Boom 💥' : 'Find all mines'}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={flagMode ? 'default' : 'secondary'}
            onClick={() => setFlagMode((m) => !m)}
            aria-pressed={flagMode}
          >
            <Flag className="size-4" /> {flagMode ? 'Flagging' : 'Flag'}
          </Button>
          <Button size="sm" variant="secondary" onClick={reset} aria-label="Restart">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-9 gap-px rounded-md bg-muted/40 p-1">
        {Array.from({ length: N * N }, (_, i) => {
          const isRevealed = revealed[i];
          const isMine = mines.has(i);
          const adj = isRevealed && !isMine ? adjacent(i, mines) : 0;
          return (
            <button
              key={i}
              onClick={() => onCellClick(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleFlag(i);
              }}
              disabled={status === 'won' || status === 'lost'}
              className={cn(
                'flex size-8 items-center justify-center rounded-[3px] text-sm font-bold transition',
                isRevealed
                  ? isMine
                    ? 'bg-rose-500/80 text-white'
                    : 'bg-card'
                  : 'bg-gradient-to-br from-slate-400/60 to-slate-500/50 hover:from-slate-400/80 dark:from-slate-600/70 dark:to-slate-700/60',
                !isRevealed && 'cursor-pointer',
              )}
              aria-label={isRevealed ? (isMine ? 'Mine' : `${adj} adjacent`) : flags[i] ? 'Flagged' : 'Hidden'}
            >
              {isRevealed ? (
                isMine ? (
                  <Bomb className="size-4" />
                ) : adj > 0 ? (
                  <span className={numberColor[adj]}>{adj}</span>
                ) : (
                  ''
                )
              ) : flags[i] ? (
                <Flag className="size-3.5 text-rose-500" />
              ) : (
                ''
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Tap to reveal · right-click or the Flag button to mark mines.
      </p>
    </div>
  );
}
