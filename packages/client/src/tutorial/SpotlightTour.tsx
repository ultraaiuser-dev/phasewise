import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  applyAction,
  GameState,
  getTutorialBotReply,
  projectStateForPlayer,
} from "@phasewise/shared";
import { useGameStore } from "../stores/gameStore.js";
import { preferences } from "../stores/preferences.js";

const steps = [
  {
    title: "Welcome to Phasewise!",
    text: "A turn has three parts: draw one card, build or add to groups, then discard one. This is a real, prepared practice table. Let’s play it together.",
    target: '[data-testid="phase-panel"]',
    info: true,
  },
  {
    title: "Step 1 — draw",
    text: "Tap the deck. You always draw before playing. Your new card gets a NEW badge; it is never selected for you.",
    target: '[data-testid="draw-deck"]',
  },
  {
    title: "Lift a card",
    text: "Tap any card in your hand. Tap it again to put it down. Arrow keys move through the hand; Enter lifts a card.",
    target: '[data-testid="hand"]',
  },
  {
    title: "Sets, runs, and Wilds",
    text: "A set has the same number: 7–7–Wild. A run has consecutive numbers: 8–9–10–11. A meld is either group on the table. Phase 1 needs two sets of three.",
    target: '[data-testid="phase-panel"]',
    info: true,
  },
  {
    title: "Build your phase",
    text: "Open Lay down. Every slot starts empty. You control which cards go into each group.",
    target: '[data-testid="lay-down"]',
  },
  {
    title: "Two sets, including a Wild",
    text: "Tap “Suggest for me” for an editable preview: two 7s with a Wild, and three 10s. Try returning a card and adding it again. When both slots show ✓, tap Lay down.",
    target: '[data-testid="lay-down-builder"]',
  },
  {
    title: "Hit a run",
    text: "Lift your remaining 7, then tap “+ add here” on Bot 1’s run. Hitting means adding a card to an existing meld. Your own phase must already be laid down.",
    target: '[data-testid="hand"], [data-testid="meld-tour-run"]',
  },
  {
    title: "Choose your Wild’s end",
    text: "Lift the Wild and add it to the run. You choose its valid value at the left or right end. A Wild never silently chooses an end for you.",
    target:
      '[data-testid="hand"], [data-testid="meld-tour-run"], [data-testid="hit-end-picker"]',
  },
  {
    title: "Add to a set",
    text: "Lift the 4 and add it to Bot 1’s set of 4s. You can hit any player’s meld after laying your own phase.",
    target: '[data-testid="hand"], [data-testid="meld-tour-set"]',
  },
  {
    title: "Discard a Skip",
    text: "Lift the Skip and press Discard. Choose Bot 1 to lose its next turn. Watch Bot 2 draw and discard in reply.",
    target:
      '[data-testid="hand"], [data-testid="discard-selected"], [data-testid="pile-discard"], [data-testid="skip-picker"]',
  },
  {
    title: "Go out",
    text: "Pick up Bot 2’s discarded 4. Lift it and hit the set of 4s. Then lift your last card, the 11, and discard it. An empty hand after laying your phase ends the round.",
    target:
      '[data-testid="discard-pile"], [data-testid="hand"], [data-testid="meld-tour-set"], [data-testid="discard-selected"], [data-testid="pile-discard"]',
  },
  {
    title: "You finished the round!",
    text: "You went out and earned 0 penalty points. Other players score the cards still in their hands. Players who laid their phase advance; everyone else tries the same phase again.",
    target: '[aria-labelledby="round-summary-title"]',
    info: true,
  },
];
type Snapshot = { state: GameState; selection: string[] };
export function SpotlightTour() {
  const s = useGameStore();
  const step = s.tourStep ?? 0;
  const data = steps[step];
  const snapshots = useRef(new Map<number, Snapshot>());
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  useEffect(() => {
    if (s.practiceFullState && !snapshots.current.has(step))
      snapshots.current.set(step, {
        state: structuredClone(s.practiceFullState),
        selection: [...s.selectedCardIds],
      });
  }, [step, s.practiceFullState, s.selectedCardIds]);
  useLayoutEffect(() => {
    const update = () => {
      const elements = [
        ...document.querySelectorAll<HTMLElement>(data.target),
      ].filter((e) => e.getBoundingClientRect().width > 0);
      const rs = elements.map((e) => e.getBoundingClientRect());
      if (!rs.length) {
        setRect(null);
        return;
      }
      const left = Math.min(...rs.map((r) => r.left)),
        top = Math.min(...rs.map((r) => r.top));
      const right = Math.max(...rs.map((r) => r.right)),
        bottom = Math.max(...rs.map((r) => r.bottom));
      setRect({
        left: left - 4,
        top: top - 4,
        width: right - left + 8,
        height: bottom - top + 8,
      });
      setPosition(
        data.target.includes("hand") ||
          data.target.includes("builder") ||
          step === 4
          ? "top"
          : top < window.innerHeight * 0.45
            ? "bottom"
            : "top",
      );
    };
    update();
    const timer = setTimeout(update, 100);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, [data, s.gameState, s.layDownModalOpen]);
  useEffect(() => {
    const gate = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-tour-controls], [data-testid="error-toast"]'))
        return;
      if (target.closest(data.target) && !data.info) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const keygate = (e: KeyboardEvent) => {
      if (e.key !== "Tab") gate(e);
    };
    document.addEventListener("click", gate, true);
    document.addEventListener("pointerdown", gate, true);
    document.addEventListener("keydown", keygate, true);
    return () => {
      document.removeEventListener("click", gate, true);
      document.removeEventListener("pointerdown", gate, true);
      document.removeEventListener("keydown", keygate, true);
    };
  }, [data]);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      data.info
        ? "[data-tour-controls] .primary"
        : step === 5
          ? '[data-testid="suggest-melds"]'
          : `${data.target.split(",")[0]} button, ${data.target.split(",")[0]}[role="button"], button${data.target.split(",")[0]}`,
    );
    target?.focus();
  }, [step, data]);
  useEffect(() => {
    const state = s.gameState;
    if (!state) return;
    const hand = state.myHand;
    const run = state.tableMelds.find((m) => m.id === "tour-run");
    const ready =
      (step === 1 && state.turnStage === "action") ||
      (step === 2 && s.selectedCardIds.length > 0) ||
      (step === 4 && s.layDownModalOpen) ||
      (step === 5 && state.players[0].hasLaidDownPhase) ||
      (step === 6 && (run?.cards.length || 0) >= 5) ||
      (step === 7 && !hand.some((c) => c.type === "wild")) ||
      (step === 8 && !hand.some((c) => c.value === 4)) ||
      (step === 9 && !hand.some((c) => c.type === "skip")) ||
      (step === 10 && state.status === "round_end");
    if (ready) s.setTourStep(step + 1);
  }, [step, s.gameState, s.selectedCardIds, s.layDownModalOpen, s.setTourStep]);
  useEffect(() => {
    const state = s.practiceFullState;
    if (
      step !== 10 ||
      !state ||
      state.status !== "playing" ||
      state.currentTurnPlayerId === "human-1"
    )
      return;
    const timer = setTimeout(() => {
      const res = applyAction(
        state,
        state.currentTurnPlayerId,
        getTutorialBotReply(state),
      );
      if (!("error" in res)) {
        useGameStore.setState({ practiceFullState: res.state });
        s.receiveState(projectStateForPlayer(res.state, "human-1"));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [step, s.practiceFullState, s.receiveState]);
  const finish = () => {
    preferences.set("pw_tour_completed", "true");
    preferences.set("pw_tour_suggested", "true");
    s.setTourStep(null);
    s.startPracticeGame(s.playerName || "You");
  };
  const skip = () => {
    preferences.set("pw_tour_suggested", "true");
    s.setTourStep(null);
    s.startPracticeGame(s.playerName || "You");
  };
  const back = () => {
    const previous = snapshots.current.get(step - 1);
    if (!previous) return;
    for (const key of snapshots.current.keys())
      if (key >= step) snapshots.current.delete(key);
    useGameStore.setState({
      practiceFullState: structuredClone(previous.state),
      tourStep: step - 1,
      layDownModalOpen: step - 1 === 5,
    });
    s.receiveState(projectStateForPlayer(previous.state, "human-1"));
    useGameStore.setState({ selectedCardIds: previous.selection });
  };
  return (
    <>
      <div className="tour-spotlight" style={rect || { inset: 0 }} />
      <aside
        className={`tour-bubble panel tour-${position}`}
        data-tour-controls="true"
        data-testid="tour-coach"
        role="region"
        aria-label="Guided tour coach"
        aria-live="polite"
      >
        <small>
          YOUR FIRST ROUND · {step + 1} / {steps.length}
        </small>
        <h2>{data.title}</h2>
        <p>{data.text}</p>
        <div
          className="tour-progress"
          aria-label={`Step ${step + 1} of ${steps.length}`}
        >
          {steps.map((_, i) => (i === step ? "●" : "○")).join("")}
        </div>
        <div className="tour-controls">
          <button onClick={back} disabled={step === 0}>
            Back
          </button>
          <button onClick={skip} aria-label="Close tutorial">
            Skip tour
          </button>
          {data.info ? (
            <button
              className="primary"
              onClick={() => (step === 11 ? finish() : s.setTourStep(step + 1))}
            >
              {step === 11 ? "Play a practice game" : "Next"}
            </button>
          ) : (
            <button
              disabled
              title="Complete the highlighted action to continue"
            >
              Next
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
