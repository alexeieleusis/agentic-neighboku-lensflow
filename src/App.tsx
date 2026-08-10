import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Lens } from "telescopejs";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "./base/TelescopeComponent";
import type { AppState } from "./App.types";
import { CounterDisplay } from "./components/CounterDisplay/CounterDisplay";
import type { CounterDisplayState } from "./components/CounterDisplay/CounterDisplay.types";
import { FaceSwatchBoard } from "./components/FaceSwatchBoard/FaceSwatchBoard";
import type { FaceSwatchBoardState } from "./components/FaceSwatchBoard/FaceSwatchBoard.types";

/**
 * Root shell demonstrating the fractal pattern end to end (not itself one of the two
 * worked examples): every child gets a magnified telescope scoped to its own state
 * slice, per requirements.md §7.2 — see docs/CONVENTIONS.md.
 */
export const App: TelescopeComponent<AppState> = function (
  props: TelescopedProps<AppState>,
): React.ReactElement {
  const counterTelescope = useMemo(
    () =>
      props.telescope.magnify(
        new Lens<AppState, CounterDisplayState>(
          (state) => state.counter,
          (counter, state) => ({ ...state, counter }),
        ),
      ),
    [props.telescope],
  );

  const faceSwatchBoardTelescope = useMemo(
    () =>
      props.telescope.magnify(
        new Lens<AppState, FaceSwatchBoardState>(
          (state) => state.faceSwatchBoard,
          (faceSwatchBoard, state) => ({ ...state, faceSwatchBoard }),
        ),
      ),
    [props.telescope],
  );

  return (
    <Stack spacing={4} sx={{ padding: 4 }}>
      <Typography variant="h4">Neighboku AI-rebuild template</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Two worked fractal-component examples below (see Storybook for the full
        catalog): a trivial-tier CounterDisplay and a split-hook-tier
        FaceSwatchBoard.
      </Typography>
      <CounterDisplay
        state={props.state.counter}
        telescope={counterTelescope}
      />
      <FaceSwatchBoard
        state={props.state.faceSwatchBoard}
        telescope={faceSwatchBoardTelescope}
      />
    </Stack>
  );
};

export default App;
