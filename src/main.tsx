import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Telescope } from "telescopejs";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import "./index.css";
import { App } from "./App.tsx";
import type { AppState, AppPreferences } from "./App.types.ts";
import { darkTheme } from "./theme.ts";
import { buildBoard } from "./game/boardBuilder.ts";
import { unfoldGame, type Game } from "./game/gameBuilder.ts";
import { mergeStoredPreferences, type JsonValue } from "./useAppDomain.ts";

/**
 * §4.2 default preferences — the merge base of the load path: every field of a
 * missing, empty, or older/partial stored blob falls back to the matching value
 * here (§4.3, `mergeStoredPreferences`), and that merge forces the result's
 * `scalars.dimension` to `3` on top (§8.5). All fields are readonly-typed.
 */
const defaultPreferences = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Faces",
  hints: {
    fitPieceCount: true,
    pieceCells: false,
    fitOnDrag: true,
    showFitPiecesOnHover: true,
    availablePiecesCount: true,
    availablePieceUniqueCell: true,
    gameIsSolvable: true,
  },
  preventInvalidMoves: true,
  sound: true,
} satisfies AppPreferences;

/**
 * §4.3 — the fixed, stable `localStorage` key of the persisted preferences
 * blob (the original hardcoded a UUID key; the rebuild's own stable key is
 * enough — compatibility with the original key is explicitly out of scope, §4.3).
 */
const PREFERENCES_STORAGE_KEY = "neighboku-preferences";

/**
 * §4.3 — the raw value stored under {@link PREFERENCES_STORAGE_KEY}, or
 * `undefined` when the key is absent or the stored blob is not parseable JSON
 * (a corrupt blob is treated as "no stored preferences", so the load path falls
 * back to the §4.2 defaults through `mergeStoredPreferences` instead of
 * crashing the app). The only `localStorage` read in the app.
 */
function readStoredPreferences(): JsonValue | undefined {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) return undefined;
    // The parse result is `any`; pin it to `unknown` so no caller can trust
    // its shape without narrowing. The cast is that single deliberate trust
    // step into the JSON shapes: `mergeStoredPreferences` re-validates every
    // field from there, so a malformed blob can never reach the app.
    const stored: unknown = JSON.parse(raw);
    return stored as JsonValue | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build a real, freshly-playable `Game` from the given preferences: a Phase 2
 * generated+validated board, then Phase 3's puzzle unfolding. Never a hand-authored
 * fixture. `preferences.scalars` drives generation; the wider app-level
 * `preventInvalidMoves` seeds the move-engine's narrow `GamePreferences` so the two
 * agree at start.
 */
function buildInitialGame(preferences: AppPreferences): Game {
  const { base, dimension, size } = preferences.scalars;
  const board = buildBoard(size, dimension, base);
  return unfoldGame(board, {
    preventInvalidMoves: preferences.preventInvalidMoves,
  });
}

/**
 * Assemble the initial shell state from a preferences object: a real, freshly-built
 * game plus the preferences themselves, with the invalid-move feedback closed
 * (Phase 11 opens it) and no drag in progress. The finished-game Dialog (Phase 15)
 * needs no initial flag: it is a pure derivation of the tray's emptiness, and a
 * freshly-unfolded game always holds pieces. Keeping this a function of the
 * preferences (rather than a module-level literal) is what a later phase's
 * load-and-rebuild-from-loaded-preferences path will reuse.
 */
function buildInitialAppState(preferences: AppPreferences): AppState {
  return {
    game: buildInitialGame(preferences),
    preferences,
    // §5.13/§5.9 (Phase 15): the game clock starts when the shell assembles its
    // initial state — the finished-game Dialog's elapsed string measures from here
    // (Phase 17's New Game panel will reset it when a fresh game starts).
    gamePlay: { startTime: Date.now() },
    invalidMoveSnackbarOpen: false,
    // §5.6 (Phase 14): no drag is in progress at start, so the hint is "None".
    dragHint: "None",
    // §5.9 (Phase 17): the New Game drawer starts closed — the flag is
    // shell-owned `AppState` (the panel's Start commit writes it too), so it
    // is seeded here like the other shell-wide flags.
    newGameDrawerOpen: false,
  };
}

// §4.3: the initial preferences are the stored blob merged over the §4.2
// defaults — missing keys, an empty blob, and older/partial shapes all fall
// back field-by-field to the defaults, and `mergeStoredPreferences` forces the
// merged `scalars.dimension` to `3` (§8.5). The board/game is NEVER read back
// from storage: every page load builds a fresh one from these (loaded)
// preferences through the existing board-generation path (§4.3 last sentence).
const initialPreferences = mergeStoredPreferences(
  defaultPreferences,
  readStoredPreferences(),
);

// §4.3: the merge is a shape guard, not a range guard — any positive integer
// `base`/`size` passes through. A stored value whose `base^dimension` pool
// allocation or board fill exceeds the runtime's limits throws here; the
// catch falls back to the §4.2 defaults so the app always starts. The first
// emission then normalizes the stored blob to the defaults, breaking the
// self-perpetuating corrupt-blob loop.
let initialState: AppState;
try {
  initialState = buildInitialAppState(initialPreferences);
} catch {
  initialState = buildInitialAppState(defaultPreferences);
}

// §5.1: the root subscribes to the telescope's stream once and re-renders
// imperatively on every emission. Components below only read the `state` snapshot
// prop — they never subscribe to a stream themselves.
const telescope: Telescope<AppState> = Telescope.of(initialState);
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
const root = createRoot(rootEl);

// §5.1: dark Material UI theme forced unconditionally, never derived from
// prefers-color-scheme or any OS/browser setting (`darkTheme` in theme.ts).
telescope.stream.forEach((state) => {
  // §4.3: persist the preferences slice on every emission (the stream replays
  // the current state on subscription, so the first write normalizes the stored
  // blob at load time too) — every preference change, from any source, lands in
  // localStorage immediately, with no persistence logic in `PreferencesDisplay`
  // itself. Only `state.preferences` is ever written: the board/game is
  // explicitly NOT persisted (§4.3).
  try {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(state.preferences),
    );
  } catch {
    // Storage unavailable (e.g. a blocked/quota-failing browser setting): the
    // app keeps running in-memory; persistence is best-effort.
  }
  root.render(
    <StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App state={state} telescope={telescope} />
      </ThemeProvider>
    </StrictMode>,
  );
});
