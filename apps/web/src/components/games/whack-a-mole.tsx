'use client';

import * as React from 'react';
import { Play, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HOLES = 9;
const GAME_SECONDS = 30;
const MOLE_MS = 750; // how often the mole relocates

type Phase = 'idle' | 'playing' | 'over';

export function WhackAMole() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [mole, setMole] = React.useState<number | null>(null);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(GAME_SECONDS);
  const [best, setBest] = React.useState(0);
  const [bonk, setBonk] = React.useState<number | null>(null);

  const moleRef = React.useRef<number | null>(null);
  moleRef.current = mole;

  const start = () => {
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setMole(Math.floor(Math.random() * HOLES));
    setPhase('playing');
  };

  // Move the mole on a timer.
  React.useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      let next = Math.floor(Math.random() * HOLES);
      if (next === moleRef.current) next = (next + 1) % HOLES;
      setMole(next);
    }, MOLE_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  // Countdown — the interval only decrements; ending is handled below.
  React.useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // End the game when the clock runs out.
  React.useEffect(() => {
    if (phase === 'playing' && timeLeft === 0) {
      setPhase('over');
      setMole(null);
      setBest((b) => Math.max(b, score));
    }
  }, [phase, timeLeft, score]);

  const whack = (i: number) => {
    if (phase !== 'playing' || i !== mole) return;
    setScore((s) => s + 1);
    setMole(null);
    setBonk(i);
    window.setTimeout(() => setBonk((b) => (b === i ? null : b)), 200);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Score: {score}</div>
        <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm font-semibold">
          <Timer className="size-4" /> {timeLeft}s
        </div>
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Best: {best}</div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: HOLES }, (_, i) => {
            const up = mole === i;
            const hit = bonk === i;
            return (
              <button
                key={i}
                onClick={() => whack(i)}
                disabled={phase !== 'playing'}
                className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-amber-900/40 to-amber-950/60 ring-2 ring-amber-950/30 sm:size-28"
                aria-label={up ? 'Mole — whack it!' : 'Empty hole'}
              >
                <span
                  className={cn(
                    'text-5xl transition-all duration-150',
                    up ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-50 opacity-0',
                  )}
                >
                  {hit ? '💥' : '🐹'}
                </span>
              </button>
            );
          })}
        </div>

        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-black/55 text-white">
            {phase === 'over' && <div className="text-2xl font-bold">Time! Score: {score}</div>}
            <Button onClick={start}>
              {phase === 'over' ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {phase === 'over' ? 'Play again' : 'Start'}
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Whack the moles as they pop up. You have {GAME_SECONDS} seconds!</p>
    </div>
  );
}
