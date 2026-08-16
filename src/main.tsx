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
import type { AppState } from "./App.types.ts";
import { darkTheme } from "./theme.ts";
import { createFaceTileId } from "./components/FaceSwatchBoard/FaceSwatchBoard.ids.ts";

const initialState: AppState = {
  counter: { count: 0 },
  faceSwatchBoard: {
    trayTileIds: [
      createFaceTileId("h0e0m0"),
      createFaceTileId("h0e1m2"),
      createFaceTileId("h1e0m1"),
      createFaceTileId("h2e2m0"),
    ],
    slotTileId: null,
  },
};

const telescope: Telescope<AppState> = Telescope.of(initialState);
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
const root = createRoot(rootEl);

// Mirrors the original app's main.tsx: the root subscribes to the telescope's stream
// once and re-renders imperatively on every emission. Components below this point only
// ever read a `state` snapshot prop — they never subscribe to a stream themselves.
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
