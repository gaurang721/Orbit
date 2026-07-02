'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Cell = 'X' | 'O' | null;

const LINES: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winner(b: Cell[]): Cell {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function isFull(b: Cell[]): boolean {
  return b.every((c) => c !== null);
}

/** Minimax scored from the AI's ('O') perspective. */
function minimax(b: Cell[], aiTurn: boolean): number {
  const w = winner(b);
  if (w === 'O') return 1;
  if (w === 'X') return -1;
  if (isFull(b)) return 0;
  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (b[i] === null) {
      const nb = b.slice();
      nb[i] = aiTurn ? 'O' : 'X';
      scores.push(minimax(nb, !aiTurn));
    }
  }
  return aiTurn ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(b: Cell[]): number {
  let best = -Infinity;
  let idx = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i] === null) {
      const nb = b.slice();
      nb[i] = 'O';
      const score = minimax(nb, false);
      if (score > best) {
        best = score;
        idx = i;
      }
    }
  }
  return idx;
}

export function TicTacToe() {
  const [board, setBoard] = React.useState<Cell[]>(() => Array<Cell>(9).fill(null));
  const win = winner(board);
  const done = win !== null || isFull(board);

  const play = (i: number) => {
    if (board[i] || done) return;
    const next = board.slice();
    next[i] = 'X';
    if (!winner(next) && !isFull(next)) {
      const ai = bestMove(next);
      if (ai >= 0) next[ai] = 'O';
    }
    setBoard(next);
  };

  const reset = () => setBoard(Array<Cell>(9).fill(null));

  const status =
    win === 'X' ? 'You win! 🎉'
      : win === 'O' ? 'AI wins 🤖'
        : isFull(board) ? "It's a draw 🤝"
          : 'Your turn — you are X';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-semibold">{status}</div>
      <div className="grid grid-cols-3 gap-2">
        {board.map((c, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            disabled={!!c || done}
            className={cn(
              'flex size-20 items-center justify-center rounded-md border bg-card text-4xl font-bold transition hover:bg-accent disabled:cursor-not-allowed',
              c === 'X' && 'text-primary',
              c === 'O' && 'text-rose-500',
            )}
            aria-label={`Cell ${i + 1}`}
          >
            {c}
          </button>
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={reset}>
        <RotateCcw className="size-4" /> New game
      </Button>
      <p className="text-xs text-muted-foreground">The AI plays perfectly — a draw is the best you can do!</p>
    </div>
  );
}
