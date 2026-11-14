"use client";

import { Clock3, Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const TIMER_PRESETS = [15, 25, 45, 60];
const SAFE_POINTER_DISTANCE = 48;

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function pointerDistanceToRect(x: number, y: number, rect: DOMRect) {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

export function PracticeClocks({ onTimerComplete }: { onTimerComplete?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerRemaining, setTimerRemaining] = useState(25 * 60_000);
  const [timerRunning, setTimerRunning] = useState(false);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerEndsAtRef = useRef(0);
  const timerRemainingRef = useRef(timerRemaining);
  const onTimerCompleteRef = useRef(onTimerComplete);
  const stopwatchStartedAtRef = useRef(0);
  const stopwatchBaseRef = useRef(0);

  useEffect(() => {
    timerRemainingRef.current = timerRemaining;
    onTimerCompleteRef.current = onTimerComplete;
  }, [onTimerComplete, timerRemaining]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerMove = (event: PointerEvent) => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const content = contentRef.current?.getBoundingClientRect();
      if (!trigger || !content) return;
      const distance = Math.min(
        pointerDistanceToRect(event.clientX, event.clientY, trigger),
        pointerDistanceToRect(event.clientX, event.clientY, content),
      );
      if (distance > SAFE_POINTER_DISTANCE) setIsOpen(false);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [isOpen]);

  useEffect(() => {
    if (!timerRunning) return;
    timerEndsAtRef.current = Date.now() + timerRemainingRef.current;
    const tick = () => {
      const next = Math.max(0, timerEndsAtRef.current - Date.now());
      setTimerRemaining(next);
      if (next === 0) {
        setTimerRunning(false);
        onTimerCompleteRef.current?.();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!stopwatchRunning) return;
    stopwatchStartedAtRef.current = Date.now();
    const tick = () => setStopwatchElapsed(stopwatchBaseRef.current + Date.now() - stopwatchStartedAtRef.current);
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [stopwatchRunning]);

  function pauseStopwatch() {
    stopwatchBaseRef.current = stopwatchElapsed;
    setStopwatchRunning(false);
  }

  function chooseTimer(minutes: number) {
    setTimerMinutes(minutes);
    setTimerRemaining(minutes * 60_000);
    setTimerRunning(false);
  }

  const activeRunning = mode === "stopwatch" ? stopwatchRunning : timerRunning;
  const activeMilliseconds = mode === "stopwatch" ? stopwatchElapsed : timerRemaining;
  const showTime = activeRunning || (mode === "stopwatch" ? stopwatchElapsed > 0 : timerRemaining !== timerMinutes * 60_000);

  function toggleActiveClock() {
    if (mode === "timer") setTimerRunning((running) => !running);
    else if (stopwatchRunning) pauseStopwatch();
    else setStopwatchRunning(true);
  }

  function resetActiveClock() {
    if (mode === "timer") {
      setTimerRunning(false);
      setTimerRemaining(timerMinutes * 60_000);
    } else {
      setStopwatchRunning(false);
      stopwatchBaseRef.current = 0;
      setStopwatchElapsed(0);
    }
  }

  function chooseMode(nextMode: "stopwatch" | "timer") {
    if (nextMode === "timer" && stopwatchRunning) pauseStopwatch();
    if (nextMode === "stopwatch") setTimerRunning(false);
    setMode(nextMode);
  }

  return (
    <div className="practice-clocks" aria-label="Practice clocks">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-2 border px-2", activeRunning ? "text-primary" : "text-muted-foreground")}
            aria-label={`Open ${mode}, ${formatTime(activeMilliseconds)}`}
          >
            {mode === "stopwatch" ? <TimerReset size={15} /> : <Clock3 size={15} />}
            {showTime && <b className="font-mono text-[0.7rem] font-semibold tabular-nums">{formatTime(activeMilliseconds)}</b>}
          </Button>
        </PopoverTrigger>

        <PopoverContent ref={contentRef} align="center" sideOffset={8} className="w-72 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className={cn("h-20 flex-col gap-2", mode === "stopwatch" && "border-primary bg-primary/10 text-primary")}
              type="button"
              onClick={() => chooseMode("stopwatch")}
            >
              <TimerReset size={23} /><span className="text-xs font-medium">Stopwatch</span>
            </Button>
            <Button
              variant="outline"
              className={cn("h-20 flex-col gap-2", mode === "timer" && "border-warning bg-warning/10 text-warning")}
              type="button"
              onClick={() => chooseMode("timer")}
            >
              <Clock3 size={23} /><span className="text-xs font-medium">Timer</span>
            </Button>
          </div>

          {mode === "timer" && (
            <div className="mt-3 grid grid-cols-4 gap-1" aria-label="Timer duration">
              {TIMER_PRESETS.map((minutes) => (
                <Button variant={minutes === timerMinutes ? "secondary" : "ghost"} size="xs" type="button" key={minutes} onClick={() => chooseTimer(minutes)}>{minutes}m</Button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button className="flex-1" size="sm" type="button" onClick={toggleActiveClock}>
              {activeRunning ? <Pause size={14} /> : <Play size={14} />}
              {activeRunning ? "Pause" : "Start"} {mode === "stopwatch" ? "Stopwatch" : "Timer"}
            </Button>
            <Button variant="ghost" size="icon-sm" type="button" onClick={resetActiveClock} aria-label={`Reset ${mode}`}><RotateCcw size={14} /></Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
