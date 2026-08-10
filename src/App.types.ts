import type { CounterDisplayState } from "./components/CounterDisplay/CounterDisplay.types";
import type { FaceSwatchBoardState } from "./components/FaceSwatchBoard/FaceSwatchBoard.types";

export interface AppState {
  readonly counter: CounterDisplayState;
  readonly faceSwatchBoard: FaceSwatchBoardState;
}
