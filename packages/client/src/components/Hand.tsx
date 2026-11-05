import { memo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, getPhaseDefinition } from "@phasewise/shared";
import { CardView } from "./CardView.js";
import { useGameStore } from "../stores/gameStore.js";

interface HandProps {
  cards: Card[];
  selected?: string[];
  contributing?: Set<string>;
  recommended?: string;
  onCard: (id: string) => void;
  onDiscard?: (id: string) => void;
  small?: boolean;
}
export const Hand = memo(function Hand({
  cards,
  selected = [],
  contributing,
  recommended,
  onCard,
  onDiscard,
  small,
}: HandProps) {
  const { handOrder, reorderHand, newCardId, doubleTapDiscard, motionEnabled } =
    useGameStore();
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
    el: HTMLElement;
  } | null>(null);
  const suppress = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout>>();
  const [inspected, setInspected] = useState<string | null>(null);
  const ordered = [...cards].sort(
    (a, b) => handOrder.indexOf(a.id) - handOrder.indexOf(b.id),
  );
  const state = useGameStore((s) => s.gameState);
  const requirements = getPhaseDefinition(
    Math.min(
      state?.players.find((p) => p.id === state.myPlayerId)?.phase || 1,
      10,
    ),
  )!.requirements;
  const help = (card: Card) =>
    card.type === "wild"
      ? "Wild fills a missing card"
      : requirements.every((r) => r.type === "set")
        ? `Helps your set of ${card.value}s`
        : requirements.every((r) => r.type === "run")
          ? "Helps your consecutive run"
          : requirements[0].type === "color_group"
            ? `Helps your ${card.color} group`
            : "Helps your set or consecutive run";
  return (
    <div
      ref={row}
      role="region"
      aria-label={small ? "Builder hand" : "Your Hand"}
      className={`hand-row ${small ? "builder-hand" : ""}`}
      data-testid={small ? "builder-hand" : "hand"}
    >
      {ordered.map((card, index) => (
        <motion.div
          key={card.id}
          layoutId={`card-${card.id}`}
          layout="position"
          transition={{ duration: motionEnabled ? 0.24 : 0 }}
          className="hand-item"
          style={{
            left: `calc(${index} * (100% - var(${small ? "--table-w" : "--hand-w"})) / ${Math.max(1, ordered.length - 1)})`,
            zIndex: selected.includes(card.id) ? 30 : index,
            touchAction: "none",
          }}
          data-testid={`hand-card-${card.id}`}
          data-hand-index={index}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: card.id,
              x: e.clientX,
              y: e.clientY,
              moved: false,
              el: e.currentTarget,
            };
            suppress.current = false;
            clearTimeout(hold.current);
            hold.current = setTimeout(() => {
              setInspected(card.id);
              suppress.current = true;
            }, 550);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== card.id) return;
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) > 7) {
              clearTimeout(hold.current);
              setInspected(null);
              if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
              d.moved = true;
              suppress.current = true;
              d.el.style.transform = `translate(${dx}px, ${dy}px)`;
              d.el.style.zIndex = "100";
              d.el.style.pointerEvents = "none";
              document.body.classList.add("card-dragging");
            }
          }}
          onPointerUp={(e) => {
            clearTimeout(hold.current);
            const d = drag.current;
            if (!d) return;
            d.el.style.transform = "";
            d.el.style.zIndex = "";
            d.el.style.pointerEvents = "";
            document.body.classList.remove("card-dragging");
            drag.current = null;
            if (!d.moved) {
              if (!suppress.current) onCard(card.id);
              suppress.current = true;
              return;
            }
            const target = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>("[data-drop]");
            if (target)
              target.dispatchEvent(
                new CustomEvent("carddrop", {
                  bubbles: true,
                  detail: { cardId: card.id },
                }),
              );
            else if (row.current) {
              const rect = row.current.getBoundingClientRect();
              const i = Math.max(
                0,
                Math.min(
                  ordered.length - 1,
                  Math.round(
                    ((e.clientX - rect.left) / rect.width) *
                      (ordered.length - 1),
                  ),
                ),
              );
              const ids = handOrder.filter((id) => id !== card.id);
              const before = ordered[i]?.id;
              const pos = ids.indexOf(before);
              ids.splice(pos < 0 ? ids.length : pos, 0, card.id);
              reorderHand(ids);
            }
          }}
          onPointerCancel={() => {
            clearTimeout(hold.current);
            setInspected(null);
            if (drag.current) {
              drag.current.el.style.transform = "";
              drag.current.el.style.pointerEvents = "";
            }
            drag.current = null;
            document.body.classList.remove("card-dragging");
          }}
          onClickCapture={(e) => {
            if (suppress.current) {
              e.preventDefault();
              e.stopPropagation();
              suppress.current = false;
            }
          }}
          onDoubleClick={() => {
            if (doubleTapDiscard) onDiscard?.(card.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const next =
                (index + (e.key === "ArrowRight" ? 1 : -1) + ordered.length) %
                ordered.length;
              if (e.altKey) {
                const ids = [...handOrder];
                const from = ids.indexOf(card.id),
                  to = ids.indexOf(ordered[next].id);
                [ids[from], ids[to]] = [ids[to], ids[from]];
                reorderHand(ids);
                return;
              }
              row.current
                ?.querySelector<HTMLElement>(
                  `[data-hand-index="${next}"] [role="button"]`,
                )
                ?.focus();
            }
          }}
        >
          <CardView
            card={card}
            className={recommended === card.id ? "recommended-card" : ""}
            small={small}
            isSelected={selected.includes(card.id)}
            isContributing={contributing?.has(card.id)}
            isDimmed={
              !!contributing?.size &&
              !contributing.has(card.id) &&
              recommended !== card.id
            }
            label={
              contributing?.has(card.id)
                ? card.type === "wild"
                  ? "Wild helps fill a missing number or color"
                  : help(card)
                : undefined
            }
            onClick={() => onCard(card.id)}
          />
          {contributing?.has(card.id) && (
            <span
              className={`hand-help ${inspected === card.id ? "inspected" : ""}`}
              role={inspected === card.id ? "tooltip" : undefined}
            >
              {help(card)}
            </span>
          )}
          {newCardId === card.id && <span className="card-badge">NEW</span>}
          {recommended === card.id && (
            <span
              className="discard-badge"
              title="Recommended discard: least useful for your phase"
            >
              ↓
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
});
