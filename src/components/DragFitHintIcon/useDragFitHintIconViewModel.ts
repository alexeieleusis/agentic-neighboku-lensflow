import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { DragHint } from "../DraggablePiece/DraggablePiece.types";
import type { DragFitHintIconViewModel } from "./DragFitHintIcon.types";

/**
 * §5.6 (Phase 14) — the accessibility label each `DragHint` announces from the
 * top-bar slot. `None`/`Unknown` share the info icon; their labels still differ so a
 * screen-reader user can tell “nothing is being dragged” from “a drag is in progress
 * but the fit is not (yet) determined”.
 */
const ARIA_LABEL = {
  None: "No piece is being dragged",
  Unknown: "Piece is being dragged",
  Ok: "Dragged piece fits",
  NotOk: "Dragged piece does not fit",
} satisfies Readonly<Record<DragHint, string>>;

/**
 * §5.6 (Phase 14) — the MUI theme color token each `DragHint` paints in: the
 * idle/undetermined states keep the default text color, while the determined states
 * take the semantic success/error colors the shell's solvability icon already uses.
 */
const COLOR = {
  None: "text.primary",
  Unknown: "text.primary",
  Ok: "success.main",
  NotOk: "error.main",
} satisfies Readonly<Record<DragHint, string>>;

/**
 * Trivial tier (requirements §7.2.1, docs/CONVENTIONS.md scale rule): a simple leaf
 * with no real state/action complexity keeps one flat view-model hook — no
 * Domain/State/Actions split. The component only maps the `DragHint` it reads off its
 * dedicated telescope to a label + color: it holds no local UI state and owns no
 * user-triggered action of its own — the hint's writes happen in the shell's
 * drag-lifecycle monitor (`useAppActions`), and this component's telescope is read-
 * only from here.
 */
export function useDragFitHintIconViewModel(
  props: Readonly<TelescopedProps<DragHint>>,
): DragFitHintIconViewModel {
  const hint = props.state;
  return {
    hint,
    ariaLabel: ARIA_LABEL[hint],
    color: COLOR[hint],
  };
}
