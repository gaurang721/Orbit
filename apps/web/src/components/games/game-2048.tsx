'use client';

import * as React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Grid = number[][];
type Dir = 'up' | 'down' | 'left' | 'right';

const SIZE = 4;

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

function emptyCells(g: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    const row = g[r]!;
    for (let c = 0; c < SIZE; c++) if (row[c] === 0) cells.push([r, c]);
  }
  return cells;
}

function spawn(g: Grid): Grid {
  const empties = emptyCells(g);
  if (empties.length === 0) return g;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)]!;
  const next = g.map((row) => row.slice());
  next[r]![c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideLeft(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    const cur = nums[i]!;
    if (cur === nums[i + 1]) {
      const merged = cur * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(cur);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

function transpose(g: Grid): Grid {
  return g[0]!.map((_, c) => g.map((row) => row[c]!));
}

function move(g: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean } {
  let work = g.map((row) => row.slice());
  const reverse = dir === 'right' || dir === 'down';
  const vertical = dir === 'up' || dir === 'down';
  if (vertical) work = transpose(work);
  if (reverse) work = work.map((row) => row.slice().reverse());
  let gained = 0;
  work = work.map((row) => {
    const res = slideLeft(row);
    gained += res.gained;
    return res.row;
  });
  if (reverse) work = work.map((row) => row.slice().reverse());
  if (vertical) work = transpose(work);
  const moved = JSON.stringify(work) !== JSON.stringify(g);
  return { grid: work, gained, moved };
}

function canMove(g: Grid): boolean {
  if (emptyCells(g).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    const row = g[r]!;
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && row[c] === row[c + 1]) return true;
      if (r + 1 < SIZE && row[c] === g[r + 1]![c]) return true;
    }
  }
  return false;
}

const TILE_STYLES: Record<number, string> = {
  0: 'bg-muted',
  2: 'bg-amber-100 text-amber-900',
  4: 'bg-amber-200 text-amber-900',
  8: 'bg-orange-300 text-white',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-white',
  256: 'bg-yellow-500 text-white',
  512: 'bg-lime-500 text-white',
  1024: 'bg-emerald-500 text-white',
  2048: 'bg-emerald-600 text-white',
};

function startGrid(): Grid {
  return spawn(spawn(emptyGrid()));
}

export function Game2048() {
  const [grid, setGrid] = React.useState<Grid>(startGrid);
  const [score, setScore] = React.useState(0);
  const [won, setWon] = React.useState(false);
  const [keepGoing, setKeepGoing] = React.useState(false);
  const over = !canMove(grid);

  const doMove = React.useCallback((dir: Dir) => {
    setGrid((g) => {
      if (!canMove(g)) return g;
      const { grid: slid, gained, moved } = move(g, dir);
      if (!moved) return g;
      if (gained) setScore((s) => s + gained);
      const next = spawn(slid);
      if (next.some((row) => row.some((v) => v >= 2048))) setWon(true);
      return next;
    });
  }, []);

  React.useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  const reset = () => {
    setGrid(startGrid());
    setScore(0);
    setWon(false);
    setKeepGoing(false);
  };

  const showOverlay = over || (won && !keepGoing);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Score: {score}</div>
        <Button size="sm" variant="secondary" onClick={reset}>
          <RotateCcw className="size-4" /> New game
        </Button>
      </div>

      <div className="relative rounded-lg bg-muted/60 p-2">
        <div className="grid grid-cols-4 gap-2">
          {grid.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                className={cn(
                  'flex size-16 items-center justify-center rounded-md text-xl font-bold transition-colors sm:size-20',
                  TILE_STYLES[v] ?? 'bg-emerald-700 text-white',
                )}
              >
                {v !== 0 ? v : ''}
              </div>
            )),
          )}
        </div>

        {showOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/60 text-white">
            <div className="text-2xl font-bold">{over ? 'Game over' : '🎉 You reached 2048!'}</div>
            <div className="flex gap-2">
              {won && !over && (
                <Button variant="secondary" onClick={() => setKeepGoing(true)}>
                  Keep going
                </Button>
              )}
              <Button onClick={reset}>
                <RotateCcw className="size-4" /> Play again
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Use arrow keys / WASD, or the buttons below.</p>
      <div className="grid w-32 grid-cols-3 gap-1">
        <div />
        <Button size="icon" variant="secondary" onClick={() => doMove('up')} aria-label="Up"><ArrowUp /></Button>
        <div />
        <Button size="icon" variant="secondary" onClick={() => doMove('left')} aria-label="Left"><ArrowLeft /></Button>
        <Button size="icon" variant="secondary" onClick={() => doMove('down')} aria-label="Down"><ArrowDown /></Button>
        <Button size="icon" variant="secondary" onClick={() => doMove('right')} aria-label="Right"><ArrowRight /></Button>
      </div>
    </div>
  );
}
