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

/**
 * §4.2 default preferences, in use on first load (no stored values yet — persistence
 * lands in Phase 16). All fields are readonly-typed.
 */
const defaultPreferences = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Shapes",
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
 * game plus the preferences themselves, with both overlays closed/inactive (Phase 11
 * opens the Snackbar, Phase 15 drives the Dialog). Keeping this a function of the
 * preferences (rather than a module-level literal) is what a later phase's
 * load-and-rebuild-from-loaded-preferences path will reuse.
 */
function buildInitialAppState(preferences: AppPreferences): AppState {
  return {
    game: buildInitialGame(preferences),
    preferences,
    invalidMoveSnackbarOpen: false,
    gameFinishedDialogOpen: false,
  };
}

// §5.1: the root subscribes to the telescope's stream once and re-renders
// imperatively on every emission. Components below only read the `state` snapshot
// prop — they never subscribe to a stream themselves.
const telescope: Telescope<AppState> = Telescope.of(
  buildInitialAppState(defaultPreferences),
);
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
const root = createRoot(rootEl);

// §5.1: dark Material UI theme forced unconditionally, never derived from
// prefers-color-scheme or any OS/browser setting (`darkTheme` in theme.ts).
telescope.stream.forEach((state) => {
  root.render(
    <StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App state={state} telescope={telescope} />
      </ThemeProvider>
    </StrictMode>,
  );
});
