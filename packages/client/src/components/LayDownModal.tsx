import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  canHandSatisfyPhase,
  getPhaseDefinition,
  MeldCard,
  validateColorGroup,
  validateRun,
  validateSet,
} from "@phasewise/shared";
import { useGameStore } from "../stores/gameStore.js";
import { Hand } from "./Hand.js";
import { CardView } from "./CardView.js";
import { DropZone } from "./DropZone.js";

export const LayDownModal = () => {
  const store = useGameStore();
  const { gameState: state, playerId, layDownModalOpen: open } = store;
  const phase = getPhaseDefinition(
    state?.players.find((p) => p.id === playerId)?.phase || 1,
  )!;
  const [slots, setSlots] = useState<MeldCard[][]>([]);
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  // Opening owns initialization. Hand updates only prune unavailable ids.
  useEffect(() => {
    if (open) {
      setSlots(phase.requirements.map(() => []));
      setActive(0);
      setPreview(false);
    }
  }, [open]);
  const hand = state?.myHand;
  useEffect(() => {
    if (open && hand) {
      const ids = new Set(hand.map((c) => c.id));
      setSlots((s) => s.map((slot) => slot.filter((c) => ids.has(c.cardId))));
    }
  }, [hand, open]);
  const checks = useMemo(
    () =>
      slots.map((cards, i) => {
        const req = phase.requirements[i];
        const items = cards.flatMap((intent) => {
          const card = hand?.find((c) => c.id === intent.cardId);
          return card ? [{ card, intent }] : [];
        });
        if (!req)
          return { valid: false as const, error: { message: "Choose a slot" } };
        return (
          req.type === "set"
            ? validateSet
            : req.type === "run"
              ? validateRun
              : validateColorGroup
        )(items, req.count);
      }),
    [slots, hand, phase],
  );
  if (!open || !state) return null;
  const used = new Set(slots.flatMap((s) => s.map((c) => c.cardId)));
  const place = (id: string, slot = active) => {
    setPreview(false);
    setSlots((s) =>
      s.map((cards, i) =>
        i === slot
          ? [...cards.filter((c) => c.cardId !== id), { cardId: id }]
          : cards.filter((c) => c.cardId !== id),
      ),
    );
  };
  const valid =
    slots.length === phase.requirements.length && checks.every((c) => c.valid);
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="lay-down-title"
      className="builder-sheet panel"
      data-testid="lay-down-builder"
      onKeyDown={(e) => {
        if (e.key === "Escape") store.setLayDownModalOpen(false);
      }}
    >
      <header>
        <div>
          <h2 id="lay-down-title">Build {phase.title}</h2>
          <p>Tap a slot, then cards. Tap a placed card to return it.</p>
        </div>
        <button
          aria-label="Close builder"
          onClick={() => store.setLayDownModalOpen(false)}
        >
          ×
        </button>
      </header>
      <div className="builder-tools">
        <button
          data-testid="suggest-melds"
          onClick={() => {
            const suggestion = canHandSatisfyPhase(state.myHand, phase.number);
            if (store.tourStep === 5) {
              suggestion.suggestedMelds = [
                {
                  type: "set",
                  cards: state.myHand
                    .slice(0, 3)
                    .map((c) => ({ cardId: c.id, representedValue: 7 })),
                },
                {
                  type: "set",
                  cards: state.myHand
                    .slice(3, 6)
                    .map((c) => ({ cardId: c.id, representedValue: 10 })),
                },
              ];
            }
            if (suggestion.suggestedMelds) {
              setSlots(suggestion.suggestedMelds.map((m) => m.cards));
              setPreview(true);
            } else
              store.setIllegalMoveError(
                "Your hand cannot complete the whole phase yet. Try building one group at a time.",
              );
          }}
        >
          ✧ Suggest for me
        </button>
        <span>
          {preview
            ? "Editable preview — change any card."
            : "You choose every card."}
        </span>
      </div>
      <div className="builder-slots">
        {phase.requirements.map((req, i) => (
          <DropZone
            key={i}
            onCardDrop={(id) => place(id, i)}
            className={`builder-slot ${active === i ? "active" : ""}`}
            data-testid={`meld-slot-${i}`}
          >
            <button
              className="slot-heading"
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              {req.description} · {slots[i]?.length || 0} of {req.count}{" "}
              {checks[i]?.valid ? "✓" : ""}
            </button>
            <div
              className="slot-cards"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/card-id");
                if (id) place(id, i);
              }}
            >
              {slots[i]?.map((intent) => {
                const card = state.myHand.find((c) => c.id === intent.cardId);
                return (
                  card && (
                    <BuilderCard
                      key={card.id}
                      card={card}
                      value={intent.representedValue}
                      onReturn={() => {
                        setPreview(false);
                        setSlots((s) =>
                          s.map((cs) => cs.filter((c) => c.cardId !== card.id)),
                        );
                      }}
                    />
                  )
                );
              })}
            </div>
            <div className="slot-message">
              {checks[i]?.valid
                ? "✓ Ready"
                : checks[i] && !checks[i].valid
                  ? checks[i].error.message
                  : `Add ${req.count} cards`}
            </div>
          </DropZone>
        ))}
      </div>
      <Hand
        cards={state.myHand.filter((c) => !used.has(c.id))}
        small
        onCard={place}
      />
      <footer>
        <button onClick={() => store.setLayDownModalOpen(false)}>Cancel</button>
        <button
          className="primary"
          data-testid="confirm-lay-down"
          disabled={!valid}
          onClick={() =>
            store.layDownPhase(
              slots.map((cards, i) => ({
                type: phase.requirements[i].type,
                cards,
              })),
            )
          }
        >
          Lay down
        </button>
      </footer>
    </section>
  );
};

function BuilderCard({
  card,
  value,
  onReturn,
}: {
  card: Card;
  value?: number;
  onReturn: () => void;
}) {
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppress = useRef(false);
  return (
    <div
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        gesture.current = { x: e.clientX, y: e.clientY, moved: false };
        suppress.current = false;
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        const x = e.clientX - g.x,
          y = e.clientY - g.y;
        if (Math.hypot(x, y) > 7) {
          if (!g.moved) e.currentTarget.setPointerCapture(e.pointerId);
          g.moved = true;
          suppress.current = true;
          e.currentTarget.style.transform = `translate(${x}px,${y}px)`;
          e.currentTarget.style.zIndex = "100";
          document.body.classList.add("card-dragging");
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        gesture.current = null;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.zIndex = "";
        document.body.classList.remove("card-dragging");
        if (!g) return;
        if (!g.moved) {
          onReturn();
          suppress.current = true;
          return;
        }
        e.currentTarget.style.pointerEvents = "none";
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-drop]");
        e.currentTarget.style.pointerEvents = "";
        target?.dispatchEvent(
          new CustomEvent("carddrop", {
            bubbles: true,
            detail: { cardId: card.id },
          }),
        );
      }}
      onPointerCancel={(e) => {
        gesture.current = null;
        e.currentTarget.style.transform = "";
        document.body.classList.remove("card-dragging");
      }}
      onClickCapture={(e) => {
        if (suppress.current) {
          e.preventDefault();
          e.stopPropagation();
          suppress.current = false;
        }
      }}
    >
      <CardView card={card} small representedValue={value} onClick={onReturn} />
    </div>
  );
}
