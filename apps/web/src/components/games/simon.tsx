'use client';

import * as React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'showing' | 'input' | 'over';

const STEP_MS = 650; // gap between flashes during playback
const LIT_MS = 400; // how long each pad stays lit

const PADS = [
  { id: 0, on: 'bg-emerald-400', off: 'bg-emerald-700/50' },
  { id: 1, on: 'bg-rose-400', off: 'bg-rose-700/50' },
  { id: 2, on: 'bg-amber-300', off: 'bg-amber-600/50' },
  { id: 3, on: 'bg-sky-400', off: 'bg-sky-700/50' },
];

const randPad = () => Math.floor(Math.random() * 4);

export function Simon() {
  const [sequence, setSequence] = React.useState<number[]>([]);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [active, setActive] = React.useState<number | null>(null);
  const [best, setBest] = React.useState(0);

  const userStepRef = React.useRef(0);
  const flashTimer = React.useRef<number | null>(null);

  const round = sequence.length;

  const start = () => {
    userStepRef.current = 0;
    setSequence([randPad()]);
    setPhase('showing');
  };

  const reset = () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    userStepRef.current = 0;
    setSequence([]);
    setActive(null);
    setPhase('idle');
  };

  // Play back the current sequence whenever we (re)enter the "showing" phase.
  React.useEffect(() => {
    if (phase !== 'showing' || sequence.length === 0) return;
    const timers: number[] = [];
    sequence.forEach((pad, i) => {
      timers.push(window.setTimeout(() => setActive(pad), i * STEP_MS));
      timers.push(window.setTimeout(() => setActive(null), i * STEP_MS + LIT_MS));
    });
    timers.push(
      window.setTimeout(() => {
        userStepRef.current = 0;
        setPhase('input');
      }, sequence.length * STEP_MS + 150),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, sequence]);

  React.useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const press = (pad: number) => {
    if (phase !== 'input') return;
    // Brief visual feedback for the tap.
    setActive(pad);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setActive(null), 180);

    const expected = sequence[userStepRef.current];
    if (pad !== expected) {
      setBest((b) => Math.max(b, sequence.length - 1));
      setPhase('over');
      return;
    }
    userStepRef.current += 1;
    if (userStepRef.current === sequence.length) {
      // Round cleared — extend the sequence and replay.
      setBest((b) => Math.max(b, sequence.length));
      window.setTimeout(() => {
        setSequence((s) => [...s, randPad()]);
        setPhase('showing');
      }, 700);
    }
  };

  const status =
    phase === 'idle'
      ? 'Press Start to play'
      : phase === 'showing'
        ? 'Watch the pattern…'
        : phase === 'input'
          ? 'Your turn — repeat it'
          : 'Wrong! Game over';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Round: {round}</div>
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Best: {best}</div>
      </div>

      <div className="text-sm font-semibold">{status}</div>

      <div className="grid grid-cols-2 gap-2">
        {PADS.map((p) => (
          <button
            key={p.id}
            onClick={() => press(p.id)}
            disabled={phase !== 'input'}
            className={cn(
              'size-24 rounded-lg transition-all duration-150 sm:size-28',
              active === p.id ? `${p.on} scale-95 shadow-lg` : p.off,
              phase === 'input' ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
            )}
            aria-label={`Pad ${p.id + 1}`}
          />
        ))}
      </div>

      {phase === 'idle' || phase === 'over' ? (
        <Button size="sm" onClick={start}>
          <Play className="size-4" /> {phase === 'over' ? 'Play again' : 'Start'}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={reset}>
          <RotateCcw className="size-4" /> Reset
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Repeat the growing sequence of pads. How far can you get?</p>
    </div>
  );
}
