import { useEffect } from "react";
import { useGameStore } from "../stores/gameStore.js";
export function Toast() {
  const { illegalMoveError: error, setIllegalMoveError: clear } =
    useGameStore();
  useEffect(() => {
    if (error) {
      const target = document.activeElement;
      target?.classList.add("rejected-action");
      setTimeout(() => target?.classList.remove("rejected-action"), 350);
      const timer = setTimeout(() => clear(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error, clear]);
  return error ? (
    <aside role="alert" className="error-toast" data-testid="error-toast">
      <div>
        <strong>Why can’t I do that?</strong>
        <p>{error}</p>
      </div>
      <button aria-label="Dismiss explanation" onClick={() => clear(null)}>
        ×
      </button>
    </aside>
  ) : null;
}
