'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EMOJIS = ['🍎', '🍌', '🍇', '🍓', '🥝', '🍑', '🍒', '🍍'];

type Tile = { id: number; emoji: string; flipped: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function newDeck(): Tile[] {
  return shuffle([...EMOJIS, ...EMOJIS]).map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

export function MemoryMatch() {
  const [tiles, setTiles] = React.useState<Tile[]>(newDeck);
  const [picks, setPicks] = React.useState<number[]>([]);
  const [moves, setMoves] = React.useState(0);
  const [lock, setLock] = React.useState(false);

  const matched = tiles.filter((t) => t.matched).length;
  const won = matched === tiles.length;

  const flip = (id: number) => {
    if (lock) return;
    const tile = tiles.find((t) => t.id === id);
    if (!tile || tile.flipped || tile.matched) return;

    const nextPicks = [...picks, id];
    setTiles((ts) => ts.map((t) => (t.id === id ? { ...t, flipped: true } : t)));
    setPicks(nextPicks);

    if (nextPicks.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = nextPicks;
      const ea = tiles.find((t) => t.id === a)?.emoji;
      const eb = id === b ? tile.emoji : tiles.find((t) => t.id === b)?.emoji;
      const isMatch = ea !== undefined && ea === eb;
      window.setTimeout(() => {
        setTiles((ts) =>
          ts.map((t) =>
            t.id === a || t.id === b
              ? { ...t, matched: isMatch ? true : t.matched, flipped: isMatch ? t.flipped : false }
              : t,
          ),
        );
        setPicks([]);
        setLock(false);
      }, isMatch ? 350 : 800);
    }
  };

  const reset = () => {
    setTiles(newDeck());
    setPicks([]);
    setMoves(0);
    setLock(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Moves: {moves}</div>
        {won && <div className="text-sm font-bold text-emerald-500">Solved in {moves} moves! 🎉</div>}
        <Button size="sm" variant="secondary" onClick={reset}>
          <RotateCcw className="size-4" /> Restart
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => {
          const show = t.flipped || t.matched;
          return (
            <button
              key={t.id}
              onClick={() => flip(t.id)}
              disabled={show || lock}
              className={cn(
                'flex size-16 items-center justify-center rounded-md text-3xl transition sm:size-20',
                show
                  ? 'border bg-card'
                  : 'bg-gradient-to-br from-violet-500/60 to-fuchsia-500/50 hover:from-violet-500/80 hover:to-fuchsia-500/70',
                t.matched && 'opacity-70 ring-2 ring-emerald-500',
              )}
              aria-label={show ? t.emoji : 'Hidden tile'}
            >
              {show ? t.emoji : ''}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Flip two tiles to find matching pairs.</p>
    </div>
  );
}
