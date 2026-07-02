'use client';

import * as React from 'react';
import { Gamepad2, X } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Game2048 } from '@/components/games/game-2048';
import { TicTacToe } from '@/components/games/tic-tac-toe';
import { MemoryMatch } from '@/components/games/memory-match';
import { SnakeGame } from '@/components/games/snake';
import { ConnectFour } from '@/components/games/connect-four';
import { Minesweeper } from '@/components/games/minesweeper';
import { Simon } from '@/components/games/simon';
import { WhackAMole } from '@/components/games/whack-a-mole';
import { WordGuess } from '@/components/games/word-guess';

type GameDef = {
  key: string;
  name: string;
  emoji: string;
  blurb: string;
  grad: string;
  Component: React.ComponentType;
};

const GAMES: GameDef[] = [
  { key: '2048', name: '2048', emoji: '🔢', blurb: 'Merge tiles to reach 2048', grad: 'from-amber-500/40 to-orange-500/30', Component: Game2048 },
  { key: 'snake', name: 'Snake', emoji: '🐍', blurb: 'Eat, grow, don’t crash', grad: 'from-emerald-500/40 to-teal-500/30', Component: SnakeGame },
  { key: 'memory', name: 'Memory Match', emoji: '🧠', blurb: 'Find all the pairs', grad: 'from-purple-500/40 to-fuchsia-500/30', Component: MemoryMatch },
  { key: 'ttt', name: 'Tic-Tac-Toe', emoji: '⭕', blurb: 'Beat the unbeatable AI', grad: 'from-sky-500/40 to-blue-500/30', Component: TicTacToe },
  { key: 'connect4', name: 'Connect Four', emoji: '🔴', blurb: 'Four in a row vs the AI', grad: 'from-blue-500/40 to-indigo-500/30', Component: ConnectFour },
  { key: 'mines', name: 'Minesweeper', emoji: '💣', blurb: 'Clear the field, dodge mines', grad: 'from-slate-500/40 to-zinc-500/30', Component: Minesweeper },
  { key: 'simon', name: 'Simon', emoji: '🎵', blurb: 'Repeat the growing pattern', grad: 'from-rose-500/40 to-red-500/30', Component: Simon },
  { key: 'whack', name: 'Whack-a-Mole', emoji: '🐹', blurb: '30s of fast-tapping fun', grad: 'from-yellow-500/40 to-amber-600/30', Component: WhackAMole },
  { key: 'word', name: 'Word Guess', emoji: '🔤', blurb: 'Crack the 5-letter word', grad: 'from-green-500/40 to-emerald-600/30', Component: WordGuess },
];

export default function GamingPage() {
  const [active, setActive] = React.useState<GameDef | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const ActiveGame = active?.Component;

  return (
    <SectionShell title="Gaming" max="max-w-4xl">
      <Card className="flex items-center gap-3 bg-gradient-to-r from-violet-500/15 to-transparent p-4">
        <Gamepad2 className="size-6 text-violet-500" />
        <p className="text-sm">Instant games you can play right here in Orbit. Pick one to start.</p>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {GAMES.map((g) => (
          <Card
            key={g.key}
            role="button"
            tabIndex={0}
            onClick={() => setActive(g)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(g);
              }
            }}
            className="card-hover cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${g.grad} text-5xl`}>{g.emoji}</div>
            <div className="p-3">
              <div className="font-bold">{g.name}</div>
              <div className="text-xs text-muted-foreground">{g.blurb}</div>
              <div className="mt-1 text-xs font-semibold text-primary">Play →</div>
            </div>
          </Card>
        ))}
      </div>

      {active && ActiveGame && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-md animate-scale-in overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span>{active.emoji}</span> {active.name}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setActive(null)} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            <ActiveGame />
          </div>
        </div>
      )}
    </SectionShell>
  );
}
