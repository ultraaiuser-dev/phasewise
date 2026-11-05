import { Card } from "../types/cards.js";
import { GameState } from "../types/game.js";
import { createDeck } from "./deck.js";
import { createInitialState, GameAction, startRound } from "./reducer.js";

/** A deterministic teaching fixture. All actions still go through applyAction. */
export function createTutorialState(): GameState {
  const deck = createDeck();
  const take = (type: Card["type"], value?: number): Card => {
    const index = deck.findIndex(
      (c) => c.type === type && (value === undefined || c.value === value),
    );
    if (index < 0) throw new Error("Tutorial deck exhausted");
    return deck.splice(index, 1)[0];
  };
  const hand = [
    take("number", 7),
    take("number", 7),
    take("wild"),
    take("number", 10),
    take("number", 10),
    take("number", 10),
    take("number", 4),
    take("wild"),
    take("skip"),
    take("number", 11),
  ];
  const set = [take("number", 4), take("number", 4), take("number", 4)];
  const run = [8, 9, 10, 11].map((v) => take("number", v));
  const draw = take("number", 7);
  const discard = take("number", 2);
  const botDraw = take("number", 4);
  let state = createInitialState("TOUR", { id: "human-1", name: "You" });
  state.players.push(
    {
      ...state.players[0],
      id: "bot-1",
      name: "Bot 1",
      isBot: true,
      isHost: false,
      seatIndex: 1,
    },
    {
      ...state.players[0],
      id: "bot-2",
      name: "Bot 2",
      isBot: true,
      isHost: false,
      seatIndex: 2,
    },
  );
  state = startRound(state, () => 0.5);
  state.players[0].hand = hand;
  state.players[1].hand = deck.splice(0, 3);
  state.players[1].phase = 2;
  state.players[1].hasLaidDownPhase = true;
  state.players[1].phaseCompletedThisRound = true;
  state.players[2].hand = deck.splice(0, 10);
  state.tableMelds = [
    {
      id: "tour-set",
      ownerId: "bot-1",
      type: "set",
      targetNumber: 4,
      cards: set.map((c) => ({
        cardId: c.id,
        representedValue: 4,
        representedColor: c.color,
      })),
    },
    {
      id: "tour-run",
      ownerId: "bot-1",
      type: "run",
      minRunValue: 8,
      maxRunValue: 11,
      cards: run.map((c) => ({
        cardId: c.id,
        representedValue: c.value,
        representedColor: c.color,
      })),
    },
  ];
  state.drawPile = [draw, botDraw, ...deck];
  state.discardPile = [discard];
  state.currentTurnPlayerId = "human-1";
  state.actionLog = [
    {
      id: "tour-start",
      timestamp: 0,
      text: "A prepared table: Bot 1 has already laid down its phase.",
    },
  ];
  return state;
}

/** Scripted reply uses the normal reducer, drawing then discarding that card. */
export function getTutorialBotReply(state: GameState): GameAction {
  if (state.turnStage === "draw") return { type: "DRAW_DECK" };
  const bot = state.players.find((p) => p.id === state.currentTurnPlayerId)!;
  return {
    type: "DISCARD",
    cardId: bot.hand.at(-1)!.id,
    skipTargetPlayerId: "bot-1",
  };
}
