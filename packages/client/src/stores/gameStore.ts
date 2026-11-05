import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import {
  applyAction,
  CardColor,
  ProposedMeld,
  EmojiReaction,
  GameAction,
  ClientGameState,
  ClientToServerEvents,
  createInitialState,
  getBotMove,
  GameState,
  projectStateForPlayer,
  ServerToClientEvents,
  startRound,
} from "@phasewise/shared";
import { preferences } from "./preferences.js";
import { reconcileInteraction } from "./interaction.js";
import { createTutorialState } from "@phasewise/shared";
import { soundManager } from "../audio/soundManager.js";

export type GameMode =
  "landing" | "lobby" | "playing" | "practice" | "tutorial";
export type AppTheme = "dark" | "light" | "high-contrast";

interface GameStore {
  // Mode & Connection
  mode: GameMode;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  connecting: boolean;
  connectionError: string | null;

  // Session
  roomId: string;
  playerId: string;
  sessionToken: string;
  playerName: string;

  // Game state
  gameState: ClientGameState | null;
  practiceFullState: GameState | null; // For local practice mode against bots

  // UI Settings (persisted in localStorage)
  theme: AppTheme;
  assistMode: boolean;
  soundEnabled: boolean;
  motionEnabled: boolean;
  soundVolume: number;

  // Modals
  scoreboardOpen: boolean;
  rulesOpen: boolean;
  layDownModalOpen: boolean;
  actionLogOpen: boolean;

  // Interaction
  handOrder: string[];
  newCardId: string | null;
  botBusy: boolean;
  doubleTapDiscard: boolean;
  tourStep: number | null;
  setTourStep: (step: number | null) => void;
  startTutorial: () => void;
  reorderHand: (ids: string[]) => void;
  toggleDoubleTap: () => void;
  receiveState: (state: ClientGameState) => void;
  selectedCardIds: string[];
  targetedMeldId: string | null;
  illegalMoveError: string | null;
  liveRegionAnnouncement: string;

  // Setters & Actions
  setMode: (mode: GameMode) => void;
  setTheme: (theme: AppTheme) => void;
  toggleAssistMode: () => void;
  toggleSound: () => void;
  setSoundVolume: (vol: number) => void;
  toggleMotion: () => void;
  setScoreboardOpen: (open: boolean) => void;
  setRulesOpen: (open: boolean) => void;
  setLayDownModalOpen: (open: boolean) => void;
  setActionLogOpen: (open: boolean) => void;
  setIllegalMoveError: (err: string | null) => void;
  announce: (msg: string) => void;

  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  toggleCardSelection: (cardId: string) => void;
  sortHandByNumber: () => void;
  sortHandByColor: () => void;

  // Network game methods
  initSocket: () => void;
  createOnlineRoom: (
    playerName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  joinOnlineRoom: (
    roomId: string,
    playerName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;

  // In-game actions
  drawDeck: () => void;
  drawDiscard: () => void;
  layDownPhase: (melds: ProposedMeld[]) => void;
  hitMeld: (
    meldId: string,
    cardId: string,
    val?: number,
    col?: CardColor,
  ) => void;
  discardCard: (cardId: string, skipTargetId?: string) => void;
  sendReaction: (emoji: EmojiReaction) => void;

  // Practice & Tutorial
  startPracticeGame: (
    playerName: string,
    botCount?: number,
    shortGame?: boolean,
  ) => void;
  processPracticeBotTurns: () => void;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

export const useGameStore = create<GameStore>((set, get) => ({
  mode: "landing",
  socket: null,
  connected: false,
  connecting: false,
  connectionError: null,

  roomId: preferences.get("pw_room_id") || "",
  playerId: preferences.get("pw_player_id") || "",
  sessionToken: preferences.get("pw_session_token") || "",
  playerName: preferences.get("pw_player_name") || "",

  gameState: null,
  practiceFullState: null,

  theme: ["dark", "light", "high-contrast"].includes(
    preferences.get("pw_theme"),
  )
    ? (preferences.get("pw_theme") as AppTheme)
    : "dark",
  assistMode: preferences.get("pw_assist_mode") !== "false", // default ON
  soundEnabled: preferences.get("pw_sound_enabled") !== "false",
  motionEnabled: preferences.get("pw_motion_enabled") !== "false",
  soundVolume: 0.5,

  scoreboardOpen: false,
  rulesOpen: false,
  layDownModalOpen: false,
  actionLogOpen: false,

  handOrder: [],
  newCardId: null,
  botBusy: false,
  tourStep: null,
  doubleTapDiscard: preferences.get("pw_double_tap") === "true",
  setTourStep: (tourStep) => set({ tourStep }),
  startTutorial: () => {
    cancelBotTimer();
    get().socket?.disconnect();
    set({ socket: null, connected: false });
    const state = createTutorialState();
    set({
      mode: "practice",
      playerId: "human-1",
      practiceFullState: state,
      tourStep: 0,
      handOrder: [],
      botBusy: false,
      layDownModalOpen: false,
      scoreboardOpen: false,
      rulesOpen: false,
      illegalMoveError: null,
    });
    get().receiveState(projectStateForPlayer(state, "human-1"));
  },
  reorderHand: (handOrder) => set({ handOrder }),
  toggleDoubleTap: () => {
    const next = !get().doubleTapDiscard;
    preferences.set("pw_double_tap", String(next));
    set({ doubleTapDiscard: next });
  },
  receiveState: (state) => {
    const prev = get().gameState;
    const interaction = reconcileInteraction(
      prev,
      state,
      get().selectedCardIds,
      get().handOrder,
      get().newCardId,
    );
    const logs = state.actionLog.filter(
      (l) => !prev?.actionLog.some((p) => p.id === l.id),
    );
    const last = logs.at(-1);
    const turn = prev?.currentTurnPlayerId !== state.currentTurnPlayerId;
    set({
      gameState: state,
      ...interaction,
      layDownModalOpen:
        state.status === "playing" &&
        state.currentTurnPlayerId === get().playerId
          ? get().layDownModalOpen
          : false,
      liveRegionAnnouncement: [
        last?.text,
        turn && state.currentTurnPlayerId === get().playerId
          ? "Your turn. Draw a card."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  },
  selectedCardIds: [],
  targetedMeldId: null,
  illegalMoveError: null,
  liveRegionAnnouncement: "",

  setMode: (mode) => set({ mode }),

  setTheme: (theme) => {
    preferences.set("pw_theme", theme);
    document.documentElement.className =
      theme === "high-contrast"
        ? "high-contrast"
        : theme === "light"
          ? "light"
          : "dark";
    set({ theme });
  },

  toggleAssistMode: () => {
    const next = !get().assistMode;
    preferences.set("pw_assist_mode", String(next));
    set({ assistMode: next });
  },

  toggleSound: () => {
    soundManager.unlock();
    const next = soundManager.toggleMute();
    preferences.set("pw_sound_enabled", String(!next));
    set({ soundEnabled: !next });
  },

  setSoundVolume: (vol) => {
    soundManager.setVolume(vol);
    set({ soundVolume: vol });
  },

  toggleMotion: () => {
    const next = !get().motionEnabled;
    preferences.set("pw_motion_enabled", String(next));
    set({ motionEnabled: next });
  },

  setScoreboardOpen: (open) => set({ scoreboardOpen: open }),
  setRulesOpen: (open) => set({ rulesOpen: open }),
  setLayDownModalOpen: (open) => set({ layDownModalOpen: open }),
  setActionLogOpen: (open) => set({ actionLogOpen: open }),
  setIllegalMoveError: (err) => {
    if (err) soundManager.playError();
    set({ illegalMoveError: err, liveRegionAnnouncement: err || "" });
  },
  announce: (msg) => set({ liveRegionAnnouncement: msg }),

  selectCard: (cardId) => set({ selectedCardIds: [cardId] }),
  deselectCard: (cardId) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
    })),
  clearSelection: () => set({ selectedCardIds: [], targetedMeldId: null }),

  toggleCardSelection: (cardId) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.includes(cardId) ? [] : [cardId],
    })),
  sortHandByNumber: () => {
    const hand = get().gameState?.myHand;
    if (hand)
      set({
        handOrder: [...hand]
          .sort(
            (a, b) =>
              (a.type === "number" ? a.value! : a.type === "wild" ? 14 : 13) -
              (b.type === "number" ? b.value! : b.type === "wild" ? 14 : 13),
          )
          .map((c) => c.id),
      });
  },
  sortHandByColor: () => {
    const hand = get().gameState?.myHand;
    if (hand)
      set({
        handOrder: [...hand]
          .sort(
            (a, b) =>
              (a.color || "z").localeCompare(b.color || "z") ||
              (a.value || 0) - (b.value || 0),
          )
          .map((c) => c.id),
      });
  },

  initSocket: () => {
    if (get().socket) return;

    set({ connecting: true, connectionError: null });
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socket.on("connect", () => {
      set({ connected: true, connecting: false, connectionError: null });
      // If we have an existing session, attempt rejoin
      const { roomId, sessionToken, playerName } = get();
      if (roomId && sessionToken) {
        socket.emit("JOIN_ROOM", { roomId, playerName, sessionToken });
      }
    });

    socket.on("connect_error", (err) => {
      set({
        connecting: false,
        connectionError:
          "Could not connect to game server. Please check connection.",
      });
    });

    socket.on("disconnect", () => {
      set({ connected: false });
    });

    socket.on("INIT_SESSION", ({ roomId, playerId, sessionToken }) => {
      preferences.set("pw_room_id", roomId);
      preferences.set("pw_player_id", playerId);
      preferences.set("pw_session_token", sessionToken);
      set({ roomId, playerId, sessionToken });
    });

    socket.on("STATE_UPDATE", ({ state }) => {
      get().receiveState(state);
      set({ mode: state.status === "lobby" ? "lobby" : "playing" });
    });

    socket.on("ACTION_ERROR", ({ message }) => {
      get().setIllegalMoveError(message);
    });

    socket.on("LATE_JOIN_REJECTED", ({ message }) => {
      get().setIllegalMoveError(message);
      set({ mode: "landing" });
    });

    socket.on("ROOM_NOT_FOUND", ({ message }) => {
      get().setIllegalMoveError(message);
      set({ mode: "landing", roomId: "", sessionToken: "" });
      preferences.remove("pw_room_id");
      preferences.remove("pw_session_token");
    });

    set({ socket });
  },

  createOnlineRoom: async (playerName: string) => {
    get().initSocket();
    preferences.set("pw_player_name", playerName);
    set({ playerName, connecting: true });

    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: playerName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        set({
          connecting: false,
          connectionError: data.error || "Failed to create room.",
        });
        return { success: false, error: data.error };
      }

      const { roomId, sessionToken, playerId } = await res.json();
      preferences.set("pw_room_id", roomId);
      preferences.set("pw_session_token", sessionToken);
      preferences.set("pw_player_id", playerId);

      set({ roomId, sessionToken, playerId, connecting: false });

      // Join via socket
      get().socket?.emit("JOIN_ROOM", { roomId, playerName, sessionToken });
      return { success: true };
    } catch (err: unknown) {
      set({
        connecting: false,
        connectionError: "Network error connecting to server.",
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  joinOnlineRoom: async (roomId: string, playerName: string) => {
    get().initSocket();
    const cleanRoom = roomId.trim().toUpperCase();
    preferences.set("pw_player_name", playerName);
    preferences.set("pw_room_id", cleanRoom);
    set({ roomId: cleanRoom, playerName, connecting: true });

    return new Promise((resolve) => {
      get().socket?.emit(
        "JOIN_ROOM",
        {
          roomId: cleanRoom,
          playerName,
          sessionToken: get().sessionToken || undefined,
        },
        (res) => {
          set({ connecting: false });
          if (res.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error });
          }
        },
      );
    });
  },

  leaveRoom: () => {
    cancelBotTimer();
    get().socket?.disconnect();
    preferences.remove("pw_room_id");
    preferences.remove("pw_session_token");
    set({
      mode: "landing",
      roomId: "",
      sessionToken: "",
      gameState: null,
      socket: null,
      practiceFullState: null,
      selectedCardIds: [],
      handOrder: [],
      botBusy: false,
      tourStep: null,
    });
  },

  drawDeck: () => performLocalOrEmit({ type: "DRAW_DECK" }),
  drawDiscard: () => performLocalOrEmit({ type: "DRAW_DISCARD" }),
  layDownPhase: (melds) =>
    performLocalOrEmit({ type: "LAY_DOWN_PHASE", melds }),
  hitMeld: (meldId, cardId, representedValue, representedColor) =>
    performLocalOrEmit({
      type: "HIT_MELD",
      meldId,
      cardId,
      representedValue,
      representedColor,
    }),
  discardCard: (cardId, skipTargetPlayerId) =>
    performLocalOrEmit({ type: "DISCARD", cardId, skipTargetPlayerId }),

  sendReaction: (emoji) => {
    get().socket?.emit("SEND_REACTION", { emoji });
  },

  // Practice mode setup
  startPracticeGame: (playerName, botCount = 2, shortGame = false) => {
    cancelBotTimer();
    get().socket?.disconnect();
    set({ socket: null, connected: false });
    const pId = "human-1";
    let state = createInitialState("PRACTICE", {
      id: pId,
      name: playerName || "You",
    });
    state.settings.shortGame = shortGame;

    for (let b = 1; b <= botCount; b++) {
      state.players.push({
        id: `bot-${b}`,
        name: `Bot ${b}`,
        seatIndex: b,
        phase: 1,
        phaseCompletedThisRound: false,
        hasLaidDownPhase: false,
        score: 0,
        roundScore: 0,
        hand: [],
        isAway: false,
        isHost: false,
        isBot: true,
        skipTurns: 0,
      });
    }

    state = startRound(state);
    const proj = projectStateForPlayer(state, pId);

    set({
      mode: "practice",
      playerId: pId,
      playerName: playerName || "You",
      practiceFullState: state,
      selectedCardIds: [],
      handOrder: [],
      tourStep: null,
      layDownModalOpen: false,
      scoreboardOpen: false,
      rulesOpen: false,
      illegalMoveError: null,
      botBusy: state.currentTurnPlayerId !== pId,
    });

    get().receiveState(proj);

    // If dealer started round and active player is a bot, run bot turns
    if (state.currentTurnPlayerId !== pId) {
      scheduleBots();
    }
  },

  processPracticeBotTurns: () => {
    const cur = get().practiceFullState;
    if (
      get().mode !== "practice" ||
      get().tourStep !== null ||
      !cur ||
      cur.status !== "playing" ||
      cur.currentTurnPlayerId === get().playerId
    ) {
      set({ botBusy: false });
      return;
    }
    const res = applyAction(
      cur,
      cur.currentTurnPlayerId,
      getBotMove(cur, cur.currentTurnPlayerId),
    );
    if ("error" in res) {
      set({ botBusy: false });
      get().setIllegalMoveError(res.error.message);
      return;
    }
    set({
      practiceFullState: res.state,
      botBusy:
        res.state.currentTurnPlayerId !== get().playerId &&
        res.state.status === "playing",
    });
    get().receiveState(projectStateForPlayer(res.state, get().playerId));
    if (get().botBusy) scheduleBots();
  },
}));

let botTimer: ReturnType<typeof setTimeout> | undefined;
function cancelBotTimer() {
  clearTimeout(botTimer);
  botTimer = undefined;
}
function scheduleBots() {
  cancelBotTimer();
  botTimer = setTimeout(
    () => useGameStore.getState().processPracticeBotTurns(),
    800,
  );
}
function performLocalOrEmit(action: GameAction) {
  const store = useGameStore.getState();
  if (store.botBusy) {
    store.setIllegalMoveError("Wait for the bot to finish its turn.");
    return;
  }
  if (store.mode === "practice" && store.practiceFullState) {
    const res = applyAction(store.practiceFullState, store.playerId, action);
    if ("error" in res) {
      store.setIllegalMoveError(res.error.message);
      return;
    }
    useGameStore.setState({
      practiceFullState: res.state,
      selectedCardIds: [],
      layDownModalOpen:
        action.type === "LAY_DOWN_PHASE" ? false : store.layDownModalOpen,
    });
    store.receiveState(projectStateForPlayer(res.state, store.playerId));
    if (
      res.state.currentTurnPlayerId !== store.playerId &&
      res.state.status === "playing" &&
      store.tourStep === null
    ) {
      useGameStore.setState({ botBusy: true });
      scheduleBots();
    }
    return;
  }
  store.clearSelection();
  switch (action.type) {
    case "DRAW_DECK":
      store.socket?.emit("DRAW_DECK");
      break;
    case "DRAW_DISCARD":
      store.socket?.emit("DRAW_DISCARD");
      break;
    case "DISCARD":
      store.socket?.emit("DISCARD", action);
      break;
    case "HIT_MELD":
      store.socket?.emit("HIT_MELD", action);
      break;
    case "LAY_DOWN_PHASE":
      store.socket?.emit("LAY_DOWN_PHASE", action);
      useGameStore.setState({ layDownModalOpen: false });
      break;
  }
}
