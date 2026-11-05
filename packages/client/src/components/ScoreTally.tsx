import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { useGameStore } from "../stores/gameStore.js";
export function ScoreTally({ from, to }: { from: number; to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useGameStore((s) => s.motionEnabled);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!enabled || reduced) {
      if (ref.current) ref.current.textContent = String(to);
      return;
    }
    const control = animate(from, to, {
      duration: 0.4,
      onUpdate: (value) => {
        if (ref.current) ref.current.textContent = String(Math.round(value));
      },
    });
    return () => control.stop();
  }, [from, to, enabled, reduced]);
  return (
    <span ref={ref} aria-label={String(to)}>
      {to}
    </span>
  );
}
