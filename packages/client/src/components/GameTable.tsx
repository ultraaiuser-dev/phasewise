import { TurnClock } from "./TurnClock.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LayoutGroup, MotionConfig, useReducedMotion } from "framer-motion";
import {
  canHandSatisfyPhase,
  getCardsContributingToPhase,
  getPhaseDefinition,
  Meld,
  validateHit,
} from "@phasewise/shared";
import { useGameStore } from "../stores/gameStore.js";
import { Hand } from "./Hand.js";
import { Piles, Seat, MeldGroup } from "./TablePieces.js";
import { CoachStrip, getPhaseProgress, usefulDiscard } from "./CoachStrip.js";
import { Toast } from "./Toast.js";
import { AnimationLayer } from "./table/AnimationLayer.js";
const LayDownModal = lazy(() =>
  import("./LayDownModal.js").then((m) => ({ default: m.LayDownModal })),
);
const ScoreboardModal = lazy(() =>
  import("./ScoreboardModal.js").then((m) => ({ default: m.ScoreboardModal })),
);
const RoundSummaryModal = lazy(() =>
  import("./RoundSummaryModal.js").then((m) => ({
    default: m.RoundSummaryModal,
  })),
);
const GameOverModal = lazy(() =>
  import("./GameOverModal.js").then((m) => ({ default: m.GameOverModal })),
);
const Settings = lazy(() =>
  import("./Settings.js").then((m) => ({ default: m.Settings })),
);
const SpotlightTour = lazy(() =>
  import("../tutorial/SpotlightTour.js").then((m) => ({
    default: m.SpotlightTour,
  })),
);

export const GameTable = () => {
  const s = useGameStore();
  const state = s.gameState;
  const reduced = useReducedMotion();
  const motion = s.motionEnabled && !reduced;
  const [settings, setSettings] = useState(false);
  const [skip, setSkip] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hitChoice, setHitChoice] = useState<{
    meld: Meld;
    id: string;
    values: number[];
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const lastTourStep = useRef(s.tourStep);
  useEffect(() => {
    if (
      s.tourStep !== null &&
      lastTourStep.current !== null &&
      s.tourStep < lastTourStep.current
    ) {
      setSkip(null);
      setHitChoice(null);
      setConfirm(null);
    }
    lastTourStep.current = s.tourStep;
  }, [s.tourStep]);
  const me = state?.players.find((p) => p.id === s.playerId);
  const myTurn =
    state?.status === "playing" &&
    state.currentTurnPlayerId === s.playerId &&
    !s.botBusy;
  const phase = getPhaseDefinition(Math.min(me?.phase || 1, 10))!;
  const selected = state?.myHand.find((c) => c.id === s.selectedCardIds[0]);
  const helpful = new Set(
    state && !me?.hasLaidDownPhase
      ? getCardsContributingToPhase(state.myHand, phase.number)
      : [],
  );
  const satisfaction = state
    ? canHandSatisfyPhase(state.myHand, phase.number)
    : { satisfied: false };
  const top = state?.discardPile.at(-1);
  const reject = (message: string) => s.setIllegalMoveError(message);
  const discard = (id = s.selectedCardIds[0], confirmed = false) => {
    if (!myTurn)
      return reject(
        "Wait for your turn. You can arrange your hand while you wait.",
      );
    if (state?.turnStage !== "action")
      return reject("You must draw a card before you can discard.");
    if (!id)
      return reject(
        "Tap one card in your hand, then Discard to finish your turn.",
      );
    const card = state.myHand.find((c) => c.id === id);
    if (!card) return;
    if (s.assistMode && helpful.has(id) && !confirmed && s.tourStep === null) {
      setConfirm(id);
      return;
    }
    if (card.type === "skip" && state.players.length > 2) {
      setSkip(id);
      return;
    }
    s.discardCard(id);
  };
  const hit = (meld: Meld, id = s.selectedCardIds[0]) => {
    if (!myTurn || state?.turnStage !== "action")
      return reject("Draw a card on your turn before adding to a meld.");
    if (!me?.hasLaidDownPhase)
      return reject(
        "Lay down your own phase before you hit (add cards to a meld).",
      );
    const card = state.myHand.find((c) => c.id === id);
    if (!card) return reject("Tap a card first, then choose a glowing meld.");
    const check = validateHit(meld, card, true);
    if (!check.valid) return reject(check.error.message);
    if (card.type === "wild" && meld.type === "run") {
      const values = [
        (meld.minRunValue || 1) - 1,
        (meld.maxRunValue || 12) + 1,
      ].filter(
        (value) =>
          validateHit(meld, card, true, { representedValue: value }).valid,
      );
      setHitChoice({ meld, id, values });
      return;
    }
    s.hitMeld(meld.id, id);
  };
  const canHit = (meld: Meld) =>
    !!(
      myTurn &&
      state?.turnStage === "action" &&
      me?.hasLaidDownPhase &&
      selected &&
      validateHit(meld, selected, true).valid
    );
  const draw = (discardPile = false) => {
    if (!myTurn) return reject("Wait for your turn before drawing.");
    if (state?.turnStage !== "draw")
      return reject(
        "You already drew a card. Build your phase or discard one card to finish.",
      );
    if (discardPile && top?.type === "skip")
      return reject(
        "Skip cards cannot be picked up from the discard pile. Draw from the deck instead.",
      );
    (discardPile ? s.drawDiscard : s.drawDeck)();
  };
  const openBuilder = () => {
    if (!myTurn || state?.turnStage !== "action")
      return reject("Draw a card on your turn, then build your phase.");
    if (me?.hasLaidDownPhase)
      return reject(
        "Your phase is already on the table. Try adding cards to a meld.",
      );
    s.setLayDownModalOpen(true);
  };
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,select,textarea,[role="dialog"]',
        ) ||
        s.tourStep !== null
      )
        return;
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        discard();
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        openBuilder();
      }
      if (e.key === "Escape") {
        s.clearSelection();
        setSettings(false);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  });
  if (!state || !me) return null;
  const others = state.players.filter((p) => p.id !== s.playerId);
  const recommended = usefulDiscard(
    state.myHand,
    phase.number,
    me.hasLaidDownPhase,
  );
  const discardHelps =
    top &&
    top.type !== "skip" &&
    !me.hasLaidDownPhase &&
    canHandSatisfyPhase([...state.myHand, top], phase.number).satisfied &&
    !satisfaction.satisfied;
  const hitTarget = selected && state.tableMelds.find(canHit);
  const coachTarget =
    !s.assistMode || !myTurn
      ? ""
      : state.turnStage === "draw"
        ? discardHelps
          ? "discard-pile"
          : "deck"
        : !me.hasLaidDownPhase && satisfaction.satisfied
          ? "lay-down"
          : hitTarget
            ? "meld"
            : "recommended";
  const coachText = !myTurn
    ? `Watch ${state.players.find((p) => p.id === state.currentTurnPlayerId)?.name || "the table"}. You can sort your cards while you wait.`
    : state.turnStage === "draw"
      ? `Step 1 of 3: Draw a card. ${discardHelps ? `The ${top?.value || top?.type} of ${top?.color || "any color"} on the discard pile completes your phase.` : "Take one from the deck, or the face-up discard if it helps."}`
      : !me.hasLaidDownPhase && satisfaction.satisfied
        ? "Step 2 of 3: Build your phase. You have every card you need. Open Lay down and choose the groups."
        : hitTarget
          ? "Step 2 of 3: Add your lifted card to the glowing meld to reduce your hand."
          : `Step 3 of 3: Discard one card to finish. ${me.hasLaidDownPhase ? "Add matching cards to melds first if you can." : "Keep matching numbers for your phase; the ↓ marker suggests a less useful card."}`;
  return (
    <MotionConfig
      reducedMotion={motion ? "never" : "always"}
      transition={{ duration: motion ? 0.3 : 0 }}
    >
      <LayoutGroup>
        <div
          className="game-table"
          data-tour-active={s.tourStep !== null ? "true" : undefined}
          data-motion={motion ? "on" : "off"}
          data-testid="game-table"
        >
          <header className="table-header panel">
            <div>
              <strong className="wordmark">
                PHASEWISE <span>✧</span>
              </strong>
              <small>
                ROOM: {state.roomId} · Round {state.roundNumber}
              </small>
            </div>
            <div className="header-actions">
              <button
                data-testid="coach-toggle"
                aria-pressed={s.assistMode}
                onClick={s.toggleAssistMode}
              >
                ✧ Coach {s.assistMode ? "on" : "off"}
              </button>
              <button
                aria-label="Game settings and shortcuts"
                onClick={() => setSettings(true)}
              >
                ☰
              </button>
            </div>
          </header>
          <div className="table-arena" data-players={state.players.length}>
            <section className="opponent-seats" aria-label="Opponents">
              {others.map((p, index) => (
                <div
                  key={p.id}
                  className={`seat-position seat-position-${index}`}
                >
                  <Seat
                    player={p}
                    active={state.currentTurnPlayerId === p.id}
                    melds={state.tableMelds.filter((m) => m.ownerId === p.id)}
                    onHit={hit}
                    canHit={canHit}
                  />
                </div>
              ))}
            </section>
            <main className="center-table">
              <div
                className={`turn-caption ${myTurn ? "your-turn" : ""}`}
                data-testid={myTurn ? "turn-banner" : "waiting-banner"}
              >
                <TurnClock
                  seconds={state.settings.turnTimerSeconds}
                  turn={`${state.currentTurnPlayerId}-${state.roundNumber}`}
                />
                {myTurn
                  ? `Your Turn: ${state.turnStage === "draw" ? "Draw a card" : "Play Melds / Discard"}`
                  : `${state.players.find((p) => p.id === state.currentTurnPlayerId)?.name} is thinking…`}
              </div>
              <Piles
                count={state.drawPileCount}
                top={top}
                drawDeck={() => draw()}
                drawDiscard={() => draw(true)}
                onDiscard={discard}
                hasSelection={
                  !!selected && myTurn && state.turnStage === "action"
                }
                coach={coachTarget}
              />
              <div className="table-melds" aria-label="Table melds">
                {state.tableMelds.length ? (
                  state.tableMelds.map((m) => (
                    <MeldGroup
                      key={m.id}
                      meld={m}
                      owner={
                        state.players.find((p) => p.id === m.ownerId)?.name ||
                        "You"
                      }
                      onHit={hit}
                      canHit={canHit(m)}
                    />
                  ))
                ) : (
                  <p className="empty-table">
                    Build your phase.
                    <br />
                    <span>Your melds will live here.</span>
                  </p>
                )}
              </div>
            </main>
          </div>
          <footer className="player-area">
            <section className="phase-panel panel" data-testid="phase-panel">
              <div>
                <strong>Your phase {me.phase}</strong>
                <span>{phase.description}</span>
              </div>
              <p>
                {me.hasLaidDownPhase
                  ? "✓ Laid down — add matching cards to any meld."
                  : getPhaseProgress(state.myHand, me.phase)}
              </p>
            </section>
            {s.assistMode && <CoachStrip text={coachText} />}
            <div className="hand-toolbar">
              <span>
                {me.name} · {state.myHand.length} cards
              </span>
              <div>
                <button onClick={s.sortHandByNumber}>Sort #</button>
                <button onClick={s.sortHandByColor}>Sort Color</button>
                <button
                  aria-label="Show action log"
                  onClick={() => setLogOpen(!logOpen)}
                >
                  Log
                </button>
              </div>
            </div>
            <Hand
              cards={s.layDownModalOpen ? [] : state.myHand}
              selected={s.selectedCardIds}
              contributing={s.assistMode ? helpful : undefined}
              recommended={
                coachTarget === "recommended" ? recommended : undefined
              }
              onCard={s.toggleCardSelection}
              onDiscard={discard}
            />
            <nav className="action-bar panel" aria-label="Turn actions">
              <span className="action-status">
                {!myTurn
                  ? "Watching the table"
                  : state.turnStage === "draw"
                    ? "Start with a draw"
                    : selected
                      ? "One card lifted"
                      : "Tap a card to lift it"}
              </span>
              {state.turnStage === "draw" ? (
                <button
                  className="primary"
                  data-testid="action-draw"
                  aria-disabled={!myTurn}
                  onClick={() => draw()}
                >
                  Draw a card
                </button>
              ) : (
                <button
                  className={coachTarget === "lay-down" ? "coach-target" : ""}
                  data-testid="lay-down"
                  aria-disabled={!myTurn || me.hasLaidDownPhase}
                  onClick={openBuilder}
                >
                  Lay down
                </button>
              )}
              <button
                className="primary"
                data-testid="discard-selected"
                aria-disabled={
                  !myTurn || state.turnStage !== "action" || !selected
                }
                onClick={() => discard()}
              >
                Discard Selected
              </button>
            </nav>
            <div className="action-caption" aria-live="polite">
              {state.actionLog.at(-1)?.text}
            </div>
          </footer>
          {logOpen && (
            <div
              className="log-panel panel"
              role="dialog"
              aria-label="Action log"
            >
              <header>
                <h2>At the table</h2>
                <button
                  onClick={() => setLogOpen(false)}
                  aria-label="Close action log"
                >
                  ×
                </button>
              </header>
              <ol>
                {state.actionLog
                  .slice(-30)
                  .reverse()
                  .map((l) => (
                    <li key={l.id}>{l.text}</li>
                  ))}
              </ol>
            </div>
          )}
          <Toast />
          <AnimationLayer state={state} enabled={!!motion} />
          {confirm && (
            <div className="dialog-shade">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Keep a useful card?"
                className="panel choice-dialog"
              >
                <h2>This card helps your phase</h2>
                <p>
                  Keeping it may help you finish your groups. Discard it anyway?
                </p>
                <button onClick={() => setConfirm(null)}>Keep card</button>
                <button
                  onClick={() => {
                    discard(confirm, true);
                    setConfirm(null);
                  }}
                >
                  Discard anyway
                </button>
              </section>
            </div>
          )}
          {skip && (
            <div className="dialog-shade">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Choose player to skip"
                className="panel choice-dialog"
                data-testid="skip-picker"
              >
                <h2>Choose Player to Skip</h2>
                <p>They lose their next turn.</p>
                {others.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      s.discardCard(skip, p.id);
                      setSkip(null);
                    }}
                  >
                    Skip {p.name} (Phase {p.phase})
                  </button>
                ))}
                <button onClick={() => setSkip(null)}>Cancel</button>
              </section>
            </div>
          )}
          {hitChoice && (
            <div className="dialog-shade">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Choose Wild value and run end"
                className="panel choice-dialog"
                data-testid="hit-end-picker"
              >
                <h2>Where should your Wild go?</h2>
                <p>Only values that extend this run are available.</p>
                {hitChoice.values.map((v) => (
                  <button
                    key={v}
                    data-testid={`hit-value-${v}`}
                    onClick={() => {
                      s.hitMeld(hitChoice.meld.id, hitChoice.id, v);
                      setHitChoice(null);
                    }}
                  >
                    {v < (hitChoice.meld.minRunValue || 1)
                      ? "Left end"
                      : "Right end"}{" "}
                    · Wild = {v}
                  </button>
                ))}
                <button onClick={() => setHitChoice(null)}>Cancel</button>
              </section>
            </div>
          )}
          <Suspense fallback={null}>
            {s.layDownModalOpen && <LayDownModal />}
            {s.scoreboardOpen && <ScoreboardModal />}
            {state.status === "round_end" && <RoundSummaryModal />}
            {state.status === "game_over" && <GameOverModal />}
            {settings && (
              <Settings
                close={() => setSettings(false)}
                onTour={() => {
                  setSettings(false);
                  s.startTutorial();
                }}
              />
            )}
            {s.tourStep !== null && <SpotlightTour />}
          </Suspense>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
};
