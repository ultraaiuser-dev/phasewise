import { useGameStore } from "../stores/gameStore.js";
import { Glossary } from "./Glossary.js";
export function Settings({
  close,
  onTour,
}: {
  close: () => void;
  onTour: () => void;
}) {
  const s = useGameStore();
  return (
    <div className="dialog-shade">
      <section
        className="panel settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Game settings"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <header>
          <h2>Make yourself at home</h2>
          <button onClick={close} aria-label="Close settings">
            ×
          </button>
        </header>
        <label>
          Theme
          <select
            value={s.theme}
            onChange={(e) => s.setTheme(e.target.value as typeof s.theme)}
          >
            <option value="dark">Evening</option>
            <option value="light">Daylight</option>
            <option value="high-contrast">High contrast</option>
          </select>
        </label>
        <button
          aria-pressed={s.motionEnabled}
          data-testid="motion-toggle"
          onClick={s.toggleMotion}
        >
          Card motion: {s.motionEnabled ? "On" : "Off"}
        </button>
        <button aria-pressed={s.soundEnabled} onClick={s.toggleSound}>
          Sound: {s.soundEnabled ? "On" : "Off"}
        </button>
        <label>
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step=".1"
            value={s.soundVolume}
            onChange={(e) => s.setSoundVolume(Number(e.target.value))}
          />
        </label>
        <button aria-pressed={s.doubleTapDiscard} onClick={s.toggleDoubleTap}>
          Double-tap to discard: {s.doubleTapDiscard ? "On" : "Off"}
        </button>
        <button onClick={onTour}>Take the guided tour</button>
        <button
          onClick={() => {
            close();
            s.setRulesOpen(true);
          }}
        >
          Rules & glossary
        </button>
        <p>
          <strong>Keyboard</strong> ← → move through your hand · Enter / Space
          select · Alt + ← / → reorder · D discard · B open builder · Escape
          close.
        </p>
        <Glossary />
        <button
          onClick={() => {
            close();
            s.setScoreboardOpen(true);
          }}
          title="Scoreboard"
        >
          Scoreboard
        </button>
        <button onClick={s.leaveRoom}>Leave room</button>
      </section>
    </div>
  );
}
