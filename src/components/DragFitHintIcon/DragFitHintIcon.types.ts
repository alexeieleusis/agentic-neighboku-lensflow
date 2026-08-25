import type { DragHint } from "../DraggablePiece/DraggablePiece.types";

/**
 * §5.6 (Phase 14) — everything `RenderDragFitHintIcon` needs, precomputed by
 * `useDragFitHintIconViewModel`. The component's state slice is the bare `DragHint`
 * value itself (`TelescopedProps<DragHint>`): the shell's `dragHint` slice projected
 * onto its own dedicated magnified telescope (the READ side of the §5.6 channel — the
 * write side is the shell's drag-lifecycle monitor, `useAppActions`). The view model
 * maps that value to its accessibility label and its MUI color token; the icon
 * element itself is picked declaratively in the render from `hint`, the same way the
 * shell's top bar picks the solvability icon from its `solvable` flag.
 */
export interface DragFitHintIconViewModel {
  /** The current `DragHint`, passed through for the icon-element choice. */
  readonly hint: DragHint;
  /** The `aria-label` the icon's slot announces (and re-announces, `aria-live`). */
  readonly ariaLabel: string;
  /** The MUI theme color token the icon paints in (e.g. `success.main`). */
  readonly color: string;
}
