// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createTutorialState, projectStateForPlayer } from "@phasewise/shared";
import { useGameStore } from "../stores/gameStore.js";
import { LayDownModal } from "./LayDownModal.js";
beforeEach(() => {
  const state = projectStateForPlayer(createTutorialState(), "human-1");
  useGameStore.setState({
    gameState: state,
    playerId: "human-1",
    handOrder: state.myHand.map((c) => c.id),
    layDownModalOpen: true,
    tourStep: null,
  });
});
it("starts empty and confirm stays disabled until all groups validate", () => {
  render(<LayDownModal />);
  expect(screen.getByTestId("confirm-lay-down")).toBeDisabled();
  expect(
    screen.getByTestId("meld-slot-0").querySelectorAll("[data-card-id]"),
  ).toHaveLength(0);
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent("0 of 3");
  fireEvent.click(screen.getByTestId("suggest-melds"));
  expect(screen.getByTestId("confirm-lay-down")).toBeEnabled();
});
it("keeps manual edits across new hand references, dropping only departed ids", () => {
  render(<LayDownModal />);
  const card = within(screen.getByTestId("builder-hand")).getAllByRole(
    "button",
  )[0];
  fireEvent.click(card);
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent("1 of 3");
  act(() => {
    const s = useGameStore.getState();
    s.receiveState({ ...s.gameState!, myHand: [...s.gameState!.myHand] });
  });
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent("1 of 3");
  act(() => {
    const s = useGameStore.getState();
    s.receiveState({ ...s.gameState!, myHand: s.gameState!.myHand.slice(1) });
  });
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent("0 of 3");
});
it("shows a rule reason for invalid groups and returns placed cards on tap", () => {
  render(<LayDownModal />);
  const hand = screen.getByTestId("builder-hand");
  fireEvent.click(within(hand).getAllByRole("button")[0]);
  fireEvent.click(
    within(hand)
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.startsWith("10 of"))!,
  );
  fireEvent.click(
    within(hand)
      .getAllByRole("button")
      .find((el) => el.getAttribute("aria-label")?.startsWith("11 of"))!,
  );
  expect(screen.getByTestId("confirm-lay-down")).toBeDisabled();
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent(/same|match/i);
  fireEvent.click(
    within(screen.getByTestId("meld-slot-0")).getAllByRole("button")[1],
  );
  expect(screen.getByTestId("meld-slot-0")).toHaveTextContent("2 of 3");
});
