// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createTutorialState, projectStateForPlayer } from "@phasewise/shared";
import { useGameStore } from "../stores/gameStore.js";
import { GameTable } from "./GameTable.js";

it("keeps rendering the table when a player advances past the final phase", async () => {
  const full = createTutorialState();
  full.status = "game_over";
  full.winnerIds = ["human-1"];
  full.players[0].phase = 11;
  full.players[0].hasLaidDownPhase = true;
  full.players[0].hand = [];
  useGameStore.setState({
    gameState: projectStateForPlayer(full, "human-1"),
    playerId: "human-1",
    motionEnabled: false,
    selectedCardIds: [],
    tourStep: null,
    mode: "practice",
  });
  render(<GameTable />);
  expect(screen.getByTestId("game-table")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: /Won/ })).toBeVisible();
});
