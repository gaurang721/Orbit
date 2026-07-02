'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLS = 7;
const ROWS = 6;

type Cell = 'R' | 'Y' | null; // R = you, Y = AI

const idx = (r: number, c: number) => r * COLS + c;
const empty = (): Cell[] => Array<Cell>(COLS * ROWS).fill(null);

/** Row a disc would land in for the given column, or -1 if the column is full. */
function landingRow(board: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[idx(r, col)] === null) return r;
  }
  return -1;
}

const DIRS: Array<[number, number]> = [
  [0, 1], // →
  [1, 0], // ↓
  [1, 1], // ↘
  [1, -1], // ↙
];

function wins(board: Cell[], p: Cell): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[idx(r, c)] !== p) continue;
      for (const [dr, dc] of DIRS) {
        let count = 1;
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[idx(nr, nc)] === p) {
          count++;
          if (count === 4) return true;
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return false;
}

function validCols(board: Cell[]): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (landingRow(board, c) >= 0) out.push(c);
  return out;
}

function drop(board: Cell[], col: number, p: Cell): Cell[] {
  const r = landingRow(board, col);
  if (r < 0) return board;
  const next = board.slice();
  next[idx(r, col)] = p;
  return next;
}

/** Heuristic AI: take a win, block your win, avoid handing you a win, else play center-ish. */
function aiMove(board: Cell[]): number {
  const cols = validCols(board);
  // 1. Win now.
  for (const c of cols) if (wins(drop(board, c, 'Y'), 'Y')) return c;
  // 2. Block your immediate win.
  for (const c of cols) if (wins(drop(board, c, 'R'), 'R')) return c;
  // 3. Don't play a move that lets you win on top of it.
  const safe = cols.filter((c) => {
    const after = drop(board, c, 'Y');
    return !validCols(after).some((c2) => wins(drop(after, c2, 'R'), 'R'));
  });
  const pool = safe.length > 0 ? safe : cols;
  // 4. Prefer columns closest to the center.
  const center = (COLS - 1) / 2;
  pool.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
  return pool[0]!;
}

export function ConnectFour() {
  const [board, setBoard] = React.useState<Cell[]>(empty);
  const [busy, setBusy] = React.useState(false);

  const youWin = wins(board, 'R');
  const aiWin = wins(board, 'Y');
  const full = validCols(board).length === 0;
  const done = youWin || aiWin || full;

  const play = (col: number) => {
    if (busy || done || landingRow(board, col) < 0) return;
    const afterYou = drop(board, col, 'R');
    setBoard(afterYou);
    if (wins(afterYou, 'R') || validCols(afterYou).length === 0) return;
    setBusy(true);
    window.setTimeout(() => {
      setBoard((b) => {
        // Guard against a reset landing mid-timeout.
        if (wins(b, 'R') || wins(b, 'Y') || validCols(b).length === 0) return b;
        return drop(b, aiMove(b), 'Y');
      });
      setBusy(false);
    }, 350);
  };

  const reset = () => {
    setBoard(empty());
    setBusy(false);
  };

  const status = youWin
    ? 'You win! 🎉'
    : aiWin
      ? 'AI wins 🤖'
      : full
        ? "It's a draw 🤝"
        : 'Your turn — drop a red disc';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-semibold">{status}</div>

      <div className="rounded-lg bg-blue-600/90 p-2">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              onClick={() => play(c)}
              disabled={busy || done || landingRow(board, c) < 0}
              className="h-5 rounded text-xs text-white/80 transition hover:bg-white/20 disabled:opacity-30"
              aria-label={`Drop in column ${c + 1}`}
            >
              ▾
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {board.map((cell, i) => (
            <div
              key={i}
              className={cn(
                'size-9 rounded-full border border-blue-700/50 sm:size-10',
                cell === 'R' ? 'bg-rose-500' : cell === 'Y' ? 'bg-amber-400' : 'bg-card',
              )}
            />
          ))}
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={reset}>
        <RotateCcw className="size-4" /> New game
      </Button>
      <p className="text-xs text-muted-foreground">Connect four of your discs in a row — across, down, or diagonally.</p>
    </div>
  );
}
