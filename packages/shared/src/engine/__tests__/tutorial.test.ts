import { describe, expect, it } from "vitest";
import { createTutorialState, getTutorialBotReply } from "../tutorial.js";
import { applyAction } from "../reducer.js";
import { canHandSatisfyPhase } from "../hints.js";
import { createDeck } from "../deck.js";
describe("additive teaching fixture", () => {
  it("is deterministic, conserves the real deck, and supports a phase with a Wild", () => {
    const a = createTutorialState(),
      b = createTutorialState();
    expect(a.players).toEqual(b.players);
    const ids = [
      ...a.players.flatMap((p) => p.hand.map((c) => c.id)),
      ...a.drawPile.map((c) => c.id),
      ...a.discardPile.map((c) => c.id),
      ...a.tableMelds.flatMap((m) => m.cards.map((c) => c.cardId)),
    ];
    expect(ids).toHaveLength(createDeck().length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(canHandSatisfyPhase(a.players[0].hand, 1).satisfied).toBe(true);
    expect(a.players[0].hand.some((c) => c.type === "wild")).toBe(true);
  });
  it("scripted bot replies are legal normal reducer actions", () => {
    let state = createTutorialState();
    state.currentTurnPlayerId = "bot-2";
    for (let i = 0; i < 2; i++) {
      const result = applyAction(state, "bot-2", getTutorialBotReply(state));
      expect("error" in result).toBe(false);
      if (!("error" in result)) state = result.state;
    }
    expect(state.currentTurnPlayerId).toBe("human-1");
  });
  it("draws the teaching 7 first and the scripted bot 4 next", () => {
    const state = createTutorialState();
    expect(state.drawPile[0].value).toBe(7);
    expect(state.drawPile[1].value).toBe(4);
  });
});
