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

const initialState: AppState = {
  counter: { count: 0 },
  faceSwatchBoard: {
    trayTileIds: ["h0e0m0", "h0e1m2", "h1e0m1", "h2e2m0"],
    slotTileId: null,
  },
};

const telescope: Telescope<AppState> = Telescope.of(initialState);
const root = createRoot(document.getElementById("root")!);

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
