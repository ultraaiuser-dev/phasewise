import { ClientGameState } from "@phasewise/shared";

export function reconcileInteraction(
  previous: ClientGameState | null,
  next: ClientGameState,
  selected: string[],
  order: string[],
  newCardId: string | null,
) {
  const ids = new Set(next.myHand.map((c) => c.id));
  const turnChanged =
    !previous ||
    previous.currentTurnPlayerId !== next.currentTurnPlayerId ||
    previous.turnStage !== next.turnStage ||
    previous.roundNumber !== next.roundNumber;
  const handChanged =
    !previous ||
    previous.myHand.length !== next.myHand.length ||
    previous.myHand.some((c) => !ids.has(c.id));
  const added = next.myHand.find(
    (c) => !previous?.myHand.some((p) => p.id === c.id),
  );
  return {
    selectedCardIds:
      turnChanged || handChanged
        ? []
        : selected.filter((id) => ids.has(id)).slice(-1),
    handOrder: [
      ...order.filter((id) => ids.has(id)),
      ...next.myHand.filter((c) => !order.includes(c.id)).map((c) => c.id),
    ],
    newCardId:
      next.turnStage === "action" &&
      next.currentTurnPlayerId === next.myPlayerId
        ? previous && added
          ? added.id
          : newCardId && ids.has(newCardId)
            ? newCardId
            : null
        : null,
  };
}
