import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, ClientGameState } from "@phasewise/shared";
import { CardView } from "../CardView.js";
import { soundManager } from "../../audio/soundManager.js";

type Rect = { x: number; y: number; width: number; height: number };
type Travel = {
  id: string;
  from: Rect;
  to: Rect;
  card?: Card;
  delay: number;
  flip: boolean;
  discard: boolean;
};
const measure = (): Map<string, Rect> => {
  const map = new Map<string, Rect>();
  document
    .querySelectorAll<HTMLElement>("[data-anchor], [data-card-id]")
    .forEach((el) => {
      if (el.closest(".animation-layer")) return;
      const r = el.getBoundingClientRect();
      map.set(el.dataset.cardId || el.dataset.anchor!, {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      });
    });
  return map;
};
/** Cosmetic projections only. Authoritative state renders immediately, independent of this queue. */
export function AnimationLayer({
  state,
  enabled,
}: {
  state: ClientGameState;
  enabled: boolean;
}) {
  const previous = useRef<ClientGameState | null>(null);
  const rects = useRef(new Map<string, Rect>());
  const serial = useRef(0);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [skip, setSkip] = useState("");
  useEffect(() => {
    const prev = previous.current;
    const before = rects.current;
    const after = measure();
    const events: Travel[] = [];
    const deal = !prev || prev.roundNumber !== state.roundNumber;
    const add = (
      from: string,
      to: string,
      card?: Card,
      delay = 0,
      flip = false,
      discard = false,
    ) => {
      const a = before.get(from) || after.get(from),
        b = after.get(to);
      if (enabled && a && b)
        events.push({
          id: `flight-${++serial.current}`,
          from: a,
          to: b,
          card,
          delay,
          flip,
          discard,
        });
    };
    if (deal) {
      state.players.forEach((p, seat) => {
        for (let i = 0; i < p.cardCount; i++) {
          const mine = p.id === state.myPlayerId;
          const card = mine ? state.myHand[i] : undefined;
          add(
            "deck",
            card?.id || `seat-${p.id}`,
            card,
            (i * state.players.length + seat) * 0.06,
            mine,
          );
        }
      });
      soundManager.playDeal();
    } else {
      const added = state.myHand.filter(
        (c) => !prev.myHand.some((p) => p.id === c.id),
      );
      added.forEach((c) =>
        add(
          prev.discardPile.at(-1)?.id === c.id ? "discard" : "deck",
          c.id,
          c,
          0,
          true,
        ),
      );
      state.myHand.length > prev.myHand.length && soundManager.playFlip();
      const logs = state.actionLog.filter(
        (l) => !prev.actionLog.some((p) => p.id === l.id),
      );
      const discardActor =
        [...logs].reverse().find((l) => /discarded/i.test(l.text))?.playerId ||
        prev.currentTurnPlayerId;
      const top = state.discardPile.at(-1);
      if (top && top.id !== prev.discardPile.at(-1)?.id) {
        const mine = prev.myHand.some((c) => c.id === top.id);
        add(
          mine ? top.id : `seat-${discardActor}`,
          "discard",
          top,
          0,
          false,
          true,
        );
        soundManager.playDiscard();
      }
      // Log entries retain actions even when React coalesces several network snapshots.
      logs
        .filter(
          (l) =>
            l.playerId &&
            l.playerId !== state.myPlayerId &&
            /drew/i.test(l.text),
        )
        .forEach((log, i) => {
          add(
            /discard/i.test(log.text) ? "discard" : "deck",
            `seat-${log.playerId}`,
            undefined,
            Math.min(i * 0.08, 0.24),
          );
          soundManager.playFlip();
        });
      for (const meld of state.tableMelds) {
        const old = prev.tableMelds.find((m) => m.id === meld.id);
        meld.cards
          .filter((c) => !old?.cards.some((o) => o.cardId === c.cardId))
          .forEach((c, i) => {
            const card = prev.myHand.find((h) => h.id === c.cardId);
            add(
              card ? c.cardId : `seat-${prev.currentTurnPlayerId}`,
              `meld-${meld.id}`,
              card,
              i * 0.04,
            );
          });
      }
      const completed = state.players.some(
        (p) =>
          p.hasLaidDownPhase &&
          !prev.players.find((q) => q.id === p.id)?.hasLaidDownPhase,
      );
      if (completed) {
        soundManager.playPhaseComplete();
        if (enabled) {
          document.querySelector('[data-testid="phase-panel"]')?.animate(
            [
              { opacity: 1, transform: "scale(1)" },
              { opacity: 0.7, transform: "scale(1.01)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 700 },
          );
          void import("canvas-confetti").then(({ default: confetti }) =>
            confetti({
              particleCount: 45,
              spread: 55,
              origin: { y: 0.6 },
              disableForReducedMotion: true,
            }),
          );
        }
      }
      const skipped = state.actionLog
        .filter((l) => !prev.actionLog.some((p) => p.id === l.id))
        .find((l) => /skip/i.test(l.text));
      if (skipped) {
        setSkip(skipped.text);
        soundManager.playSkip();
      }
    }
    if (events.length)
      setTravels((current) => [...current, ...events].slice(-72));
    if (!enabled) setTravels([]);
    previous.current = state;
    rects.current = after;
  }, [state, enabled]);
  useEffect(() => {
    if (!skip) return;
    const timer = setTimeout(() => setSkip(""), 1600);
    return () => clearTimeout(timer);
  }, [skip]);
  return (
    <div className="animation-layer" aria-hidden="true">
      <AnimatePresence>
        {travels.map((t) => (
          <motion.div
            key={t.id}
            data-testid="card-travel"
            className="travel-card"
            initial={{
              x: t.from.x,
              y: t.from.y,
              rotateY: t.flip ? 180 : 0,
              rotate: 0,
              opacity: 0.95,
              scale: 0.8,
            }}
            animate={{
              x: t.to.x,
              y: t.discard
                ? [t.from.y, Math.min(t.from.y, t.to.y) - 35, t.to.y]
                : t.to.y,
              rotateY: 0,
              rotate: t.discard ? (serial.current % 2 ? 5 : -4) : 0,
              opacity: [0.95, 1, 0],
              scale: 1,
            }}
            transition={{ duration: 0.4, delay: t.delay, ease: "easeOut" }}
            onAnimationComplete={() =>
              setTravels((ts) => ts.filter((x) => x.id !== t.id))
            }
          >
            {t.card ? (
              <>
                <div className="flight-front">
                  <CardView card={t.card} />
                </div>
                {t.flip && (
                  <div className="flight-back card-hand card-back">✧</div>
                )}
              </>
            ) : (
              <div className="card-hand card-back">✧</div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {skip && (
        <motion.div
          className="skip-banner"
          initial={{ opacity: 0, x: enabled ? -10 : 0 }}
          animate={{ opacity: 1, x: enabled ? [0, -5, 5, 0] : 0 }}
        >
          SKIPPED · {skip}
        </motion.div>
      )}
    </div>
  );
}
