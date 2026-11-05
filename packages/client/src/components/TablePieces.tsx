import { memo } from "react";
import { createDeck, Meld, PublicPlayer, Card } from "@phasewise/shared";
import { motion } from "framer-motion";
import { CardView } from "./CardView.js";
import { DropZone } from "./DropZone.js";

const cardCatalog = new Map(createDeck().map((c) => [c.id, c]));
export const MeldGroup = memo(function MeldGroup({
  meld,
  owner,
  onHit,
  canHit,
  mini = false,
}: {
  meld: Meld;
  owner: string;
  onHit: (m: Meld, id?: string) => void;
  canHit: boolean;
  mini?: boolean;
}) {
  return (
    <DropZone
      className={`meld-group ${canHit ? "hittable" : ""} ${mini ? "mini-meld" : ""}`}
      data-testid={`${mini ? "seat-" : ""}meld-${meld.id}`}
      data-anchor={mini ? undefined : `meld-${meld.id}`}
      role={mini ? "button" : undefined}
      tabIndex={mini ? 0 : undefined}
      aria-label={mini ? `Add to ${owner}'s ${meld.type}` : undefined}
      onClick={(e) => {
        if (mini || !(e.target as Element).closest("button")) onHit(meld);
      }}
      onKeyDown={(e) => {
        if (mini && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onHit(meld);
        }
      }}
      onCardDrop={(id) => onHit(meld, id)}
    >
      <button
        className="meld-label"
        aria-label={`Add to ${owner}'s ${meld.type.replace("_", " ")}`}
        onClick={() => onHit(meld)}
      >
        <span>
          {owner} ·{" "}
          {meld.type === "set"
            ? `Set of ${meld.targetNumber}s`
            : meld.type === "run"
              ? `Run ${meld.minRunValue}–${meld.maxRunValue}`
              : `${meld.targetColor} group`}
        </span>
        {canHit && <strong>+ add here</strong>}
      </button>
      <div className="meld-cards" aria-hidden={mini || undefined}>
        {meld.cards.map((c) => (
          <motion.div
            key={c.cardId}
            layoutId={mini ? undefined : `card-${c.cardId}`}
            layout="position"
          >
            <CardView
              card={
                cardCatalog.get(c.cardId) || {
                  id: c.cardId,
                  type: "number",
                  value: c.representedValue,
                  color: c.representedColor,
                }
              }
              representedValue={c.representedValue}
              representedColor={c.representedColor}
              small={!mini}
              mini={mini}
            />
          </motion.div>
        ))}
      </div>
    </DropZone>
  );
});
export const Seat = memo(function Seat({
  player,
  active,
  melds,
  onHit,
  canHit,
}: {
  player: PublicPlayer;
  active: boolean;
  melds: Meld[];
  onHit: (m: Meld, id?: string) => void;
  canHit: (m: Meld) => boolean;
}) {
  return (
    <motion.article
      className={`seat panel ${active ? "seat-active" : ""} ${player.skipTurns ? "seat-skipped" : ""}`}
      data-anchor={`seat-${player.id}`}
      data-testid={`seat-${player.id}`}
      aria-label={`${player.name}, phase ${player.phase}, ${player.cardCount} cards, ${player.score} points${player.isAway ? ", disconnected" : ""}`}
    >
      {active && (
        <motion.div
          layoutId="active-seat"
          className="seat-highlight"
          transition={{ duration: 0.25 }}
        />
      )}
      <div className="seat-title">
        <strong>{player.name}</strong>
        <span className="phase-badge">P{player.phase}</span>
      </div>
      <div className="seat-details">
        <span className="card-back-stack" aria-hidden="true">
          ▧
        </span>
        <span>{player.cardCount} cards</span>
        <span>{player.score} pts</span>
      </div>
      {player.isAway && <span className="away">○ Away / disconnected</span>}
      {player.skipTurns > 0 && <strong className="skip-label">SKIPPED</strong>}
      <div className="seat-melds">
        {melds.map((m) => (
          <MeldGroup
            key={m.id}
            meld={m}
            owner={player.name}
            mini
            onHit={onHit}
            canHit={canHit(m)}
          />
        ))}
      </div>
    </motion.article>
  );
});

export function Piles({
  count,
  top,
  drawDeck,
  drawDiscard,
  onDiscard,
  hasSelection,
  coach,
}: {
  count: number;
  top?: Card;
  drawDeck: () => void;
  drawDiscard: () => void;
  onDiscard: (id?: string) => void;
  hasSelection: boolean;
  coach: string;
}) {
  return (
    <div className="piles">
      <button
        className={`deck pile-stack ${coach === "deck" ? "coach-target" : ""}`}
        data-anchor="deck"
        data-testid="draw-deck"
        aria-label={`Draw Pile: ${count} cards remaining`}
        onClick={drawDeck}
      >
        <span className="deck-mark">✧</span>
        <strong>DRAW</strong>
        <small>{count} left</small>
      </button>
      <DropZone
        onCardDrop={onDiscard}
        className={`discard-zone ${coach === "discard-pile" ? "coach-target" : ""}`}
        data-anchor="discard"
        data-testid="discard-pile"
      >
        <button
          className="discard-top pile-stack"
          aria-label={
            top
              ? `Discard Pile: ${top.value || top.type} ${top.color || ""}`
              : "Discard pile empty"
          }
          onClick={drawDiscard}
        >
          {top ? (
            <motion.div layoutId={`card-${top.id}`}>
              <CardView card={top} />
            </motion.div>
          ) : (
            <span className="empty-pile">Empty</span>
          )}
        </button>
        {hasSelection && (
          <button
            className="discard-at-pile primary"
            data-testid="pile-discard"
            onClick={() => onDiscard()}
          >
            Discard ↓
          </button>
        )}
      </DropZone>
    </div>
  );
}
