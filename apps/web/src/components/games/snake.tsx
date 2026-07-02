'use client';

import * as React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SIZE = 15;
const TICK_MS = 140;

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

const START_SNAKE: Point[] = [{ x: 7, y: 7 }];
const START_FOOD: Point = { x: 11, y: 7 };

function randFood(snake: Point[]): Point {
  const empty: Point[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) empty.push({ x, y });
    }
  if (empty.length === 0) return snake[0]!;
  return empty[Math.floor(Math.random() * empty.length)]!;
}

export function SnakeGame() {
  const [snake, setSnake] = React.useState<Point[]>(START_SNAKE);
  const [food, setFood] = React.useState<Point>(START_FOOD);
  const [score, setScore] = React.useState(0);
  const [over, setOver] = React.useState(false);
  const [running, setRunning] = React.useState(true);

  // Refs hold the latest state for the interval loop without re-subscribing.
  const snakeRef = React.useRef(snake);
  const foodRef = React.useRef(food);
  const dirRef = React.useRef<Dir>('right');
  const queuedRef = React.useRef<Dir | null>(null);
  snakeRef.current = snake;
  foodRef.current = food;

  const turn = React.useCallback((d: Dir) => {
    if (OPPOSITE[d] !== dirRef.current) queuedRef.current = d;
  }, []);

  React.useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    };
    const onKey = (e: KeyboardEvent) => {
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        turn(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  React.useEffect(() => {
    if (!running || over) return;
    const id = window.setInterval(() => {
      const nd = queuedRef.current ?? dirRef.current;
      dirRef.current = nd;
      queuedRef.current = null;

      const prev = snakeRef.current;
      const head = prev[0]!;
      const nx = head.x + DELTA[nd].x;
      const ny = head.y + DELTA[nd].y;

      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) {
        setOver(true);
        return;
      }
      const eating = foodRef.current.x === nx && foodRef.current.y === ny;
      const body = eating ? prev : prev.slice(0, prev.length - 1);
      if (body.some((s) => s.x === nx && s.y === ny)) {
        setOver(true);
        return;
      }
      const next = [{ x: nx, y: ny }, ...body];
      snakeRef.current = next;
      setSnake(next);
      if (eating) {
        setScore((s) => s + 1);
        const nf = randFood(next);
        foodRef.current = nf;
        setFood(nf);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, over]);

  const reset = () => {
    snakeRef.current = START_SNAKE;
    foodRef.current = START_FOOD;
    dirRef.current = 'right';
    queuedRef.current = null;
    setSnake(START_SNAKE);
    setFood(START_FOOD);
    setScore(0);
    setOver(false);
    setRunning(true);
  };

  const headPt = snake[0]!;
  const headKey = `${headPt.x},${headPt.y}`;
  const bodySet = new Set(snake.slice(1).map((s) => `${s.x},${s.y}`));
  const foodKey = `${food.x},${food.y}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">Score: {score}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRunning((r) => !r)} disabled={over}>
            {running ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={reset}>
            <RotateCcw className="size-4" /> Restart
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          className="grid gap-px rounded-md bg-muted/40 p-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            const key = `${x},${y}`;
            const isHead = key === headKey;
            const isBody = bodySet.has(key);
            const isFood = key === foodKey;
            return (
              <div
                key={i}
                className={cn(
                  'size-5 rounded-[3px] sm:size-6',
                  isHead ? 'bg-emerald-600' : isBody ? 'bg-emerald-400' : isFood ? 'bg-rose-500' : 'bg-card',
                )}
              />
            );
          })}
        </div>
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-black/60 text-white">
            <div className="text-2xl font-bold">Game over</div>
            <div className="text-sm">Score: {score}</div>
            <Button onClick={reset}>
              <RotateCcw className="size-4" /> Play again
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Arrow keys / WASD or the buttons to steer.</p>
      <div className="grid w-32 grid-cols-3 gap-1">
        <div />
        <Button size="icon" variant="secondary" onClick={() => turn('up')} aria-label="Up"><ArrowUp /></Button>
        <div />
        <Button size="icon" variant="secondary" onClick={() => turn('left')} aria-label="Left"><ArrowLeft /></Button>
        <Button size="icon" variant="secondary" onClick={() => turn('down')} aria-label="Down"><ArrowDown /></Button>
        <Button size="icon" variant="secondary" onClick={() => turn('right')} aria-label="Right"><ArrowRight /></Button>
      </div>
    </div>
  );
}
