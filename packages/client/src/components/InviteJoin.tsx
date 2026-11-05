import { useEffect, useState } from "react";
import { useGameStore } from "../stores/gameStore.js";
import { preferences } from "../stores/preferences.js";
export function InviteJoin({
  code,
  onCancel,
}: {
  code: string;
  onCancel: () => void;
}) {
  const [name, setName] = useState(preferences.get("pw_player_name"));
  const [players, setPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/rooms/${code}/preview`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            "This room is unavailable. Check the code with your host.",
          );
        return res.json() as Promise<{ players: { name: string }[] }>;
      })
      .then((data) => setPlayers(data.players.map((p) => p.name)))
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [code]);
  return (
    <main className="invite-screen">
      <form
        className="panel settings-dialog"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setLoading(true);
          const result = await useGameStore
            .getState()
            .joinOnlineRoom(code, name.trim());
          setLoading(false);
          if (!result.success) setError(result.error || "Could not join room.");
        }}
      >
        <small>YOU’RE INVITED</small>
        <h1>Join room {code}</h1>
        <p>
          {players.length
            ? `At the table: ${players.join(", ")}`
            : "Checking who’s at the table…"}
        </p>
        <label htmlFor="invite-name">Your name</label>
        <input
          id="invite-name"
          autoFocus
          required
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
        />
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={loading || !name.trim()}>
          {loading ? "Joining…" : "Join the table"}
        </button>
        <button type="button" onClick={onCancel}>
          Back to home
        </button>
      </form>
    </main>
  );
}
