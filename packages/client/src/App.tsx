import { lazy, Suspense, useEffect, useState } from "react";
import { useGameStore } from "./stores/gameStore.js";
import { preferences } from "./stores/preferences.js";
import { soundManager } from "./audio/soundManager.js";
import { LandingPage } from "./components/LandingPage.js";
import { LobbyView } from "./components/LobbyView.js";
import { GameTable } from "./components/GameTable.js";
import { InviteJoin } from "./components/InviteJoin.js";
const RulesModal = lazy(() =>
  import("./components/RulesModal.js").then((m) => ({ default: m.RulesModal })),
);

export const App = () => {
  const s = useGameStore();
  const [invite, setInvite] = useState(
    () =>
      window.location.pathname
        .match(/^\/r\/([A-Za-z0-9]{5})\/?$/)?.[1]
        .toUpperCase() || "",
  );
  const [suggest, setSuggest] = useState(
    () =>
      preferences.get("pw_tour_suggested") !== "true" &&
      preferences.get("pw_tour_completed") !== "true",
  );
  useEffect(() => {
    document.documentElement.className = s.theme;
  }, [s.theme]);
  useEffect(() => {
    if (preferences.get("pw_room_id") && preferences.get("pw_session_token"))
      s.initSocket();
  }, []);
  useEffect(() => {
    const unlock = () => {
      soundManager.unlock();
      soundManager.setMuted(!useGameStore.getState().soundEnabled);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  // Keep keyboard focus inside the topmost modal, and restore focus when it closes.
  useEffect(() => {
    let current: Element | null = null;
    let returnFocus: HTMLElement | null = null;
    const sync = () => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      const next = dialogs.item(dialogs.length - 1);
      if (next !== current) {
        if (next) {
          returnFocus = document.activeElement as HTMLElement;
          const heading = next.querySelector<HTMLElement>("h2");
          if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          } else
            next
              .querySelector<HTMLElement>(
                'button:not(:disabled),input,select,[tabindex="0"]',
              )
              ?.focus({ preventScroll: true });
        } else returnFocus?.focus();
        current = next;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const trap = (e: KeyboardEvent) => {
      if (!current) return;
      const controls = [
        ...current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
        ...document.querySelectorAll<HTMLElement>(
          "[data-tour-controls] button:not(:disabled)",
        ),
      ].filter((el) => el.getClientRects().length);
      if (e.key === "Tab" && controls.length) {
        const first = controls[0],
          last = controls.at(-1)!;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !controls.includes(document.activeElement as HTMLElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", trap);
    };
  }, []);
  const startTour = () => {
    setSuggest(false);
    preferences.set("pw_tour_suggested", "true");
    s.startTutorial();
  };
  return (
    <div className="app-shell">
      <div role="status" aria-live="polite" className="sr-only">
        {s.liveRegionAnnouncement}
      </div>
      {s.mode === "landing" &&
        (invite ? (
          <InviteJoin
            code={invite}
            onCancel={() => {
              setInvite("");
              history.replaceState(null, "", "/");
            }}
          />
        ) : (
          <>
            <LandingPage
              onOpenTutorial={startTour}
              onOpenRules={() => s.setRulesOpen(true)}
            />
            {suggest && (
              <aside className="onboarding-tip panel">
                <div>
                  <strong>New here?</strong>
                  <p>Learn on a real table in the 2-minute tour.</p>
                </div>
                <button onClick={startTour}>Take the tour</button>
                <button
                  aria-label="Dismiss tour suggestion"
                  onClick={() => {
                    setSuggest(false);
                    preferences.set("pw_tour_suggested", "true");
                  }}
                >
                  ×
                </button>
              </aside>
            )}
          </>
        ))}
      {s.mode === "lobby" && <LobbyView />}
      {(s.mode === "playing" || s.mode === "practice") && <GameTable />}
      <Suspense fallback={null}>
        {s.rulesOpen && (
          <RulesModal isOpen onClose={() => s.setRulesOpen(false)} />
        )}
      </Suspense>
    </div>
  );
};
