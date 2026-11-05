import { io } from "socket.io-client";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAction,
  createTutorialState,
  projectStateForPlayer,
} from "@phasewise/shared";
import { useGameStore } from "./gameStore.js";

const initial = () => projectStateForPlayer(createTutorialState(), "human-1");
describe("intentional selection and persistent order", () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      selectedCardIds: [],
      handOrder: [],
      newCardId: null,
      playerId: "human-1",
    });
    useGameStore.getState().receiveState(initial());
  });
  it("single selects only on tap and tapping again clears", () => {
    const s = useGameStore.getState();
    s.toggleCardSelection("a");
    s.toggleCardSelection("b");
    expect(useGameStore.getState().selectedCardIds).toEqual(["b"]);
    s.toggleCardSelection("b");
    expect(useGameStore.getState().selectedCardIds).toEqual([]);
  });
  it("clears selection on draw and marks the new card without selecting it", () => {
    const s = useGameStore.getState();
    s.selectCard(initial().myHand[0].id);
    const full = createTutorialState();
    const result = applyAction(full, "human-1", { type: "DRAW_DECK" });
    if ("error" in result) throw new Error(result.error.message);
    s.receiveState(projectStateForPlayer(result.state, "human-1"));
    expect(useGameStore.getState().selectedCardIds).toEqual([]);
    expect(useGameStore.getState().newCardId).toBe(
      result.state.players[0].hand.at(-1)?.id,
    );
  });
  it.each(["turn", "round", "hand"] as const)("clears on %s change", (kind) => {
    const s = useGameStore.getState();
    const state = initial();
    s.selectCard(state.myHand[0].id);
    s.receiveState({
      ...state,
      ...(kind === "turn"
        ? { currentTurnPlayerId: "bot-1" }
        : kind === "round"
          ? { roundNumber: 2 }
          : { myHand: state.myHand.slice(1) }),
    });
    expect(useGameStore.getState().selectedCardIds).toEqual([]);
  });
  it("retains manual order on equivalent network snapshots and appends new ids", () => {
    const s = useGameStore.getState();
    const state = initial();
    const reverse = state.myHand.map((c) => c.id).reverse();
    s.reorderHand(reverse);
    s.receiveState(structuredClone(state));
    expect(useGameStore.getState().handOrder).toEqual(reverse);
    s.receiveState({
      ...state,
      myHand: [...state.myHand.slice(1), { id: "new", type: "wild" }],
    });
    expect(useGameStore.getState().handOrder).toEqual([
      ...reverse.filter((id) => id !== state.myHand[0].id),
      "new",
    ]);
  });
  it("sort changes client order without mutating the authoritative hand", () => {
    const s = useGameStore.getState();
    const hand = s.gameState!.myHand;
    s.sortHandByColor();
    s.receiveState(initial());
    expect(useGameStore.getState().gameState!.myHand).toEqual(hand);
    expect(useGameStore.getState().handOrder).not.toEqual([]);
  });
});

it("isolates the real-table tour from an earlier multiplayer connection", () => {
  const socket = io("http://127.0.0.1:1", { autoConnect: false });
  const disconnect = vi.spyOn(socket, "disconnect");
  useGameStore.setState({ socket, mode: "playing" });
  useGameStore.getState().startTutorial();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(useGameStore.getState().socket).toBeNull();
  expect(useGameStore.getState().gameState?.roomId).toBe("TOUR");
});
