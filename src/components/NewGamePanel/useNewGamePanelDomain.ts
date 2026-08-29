import type { NewGamePanelSelection } from "./NewGamePanel.types.ts";

/**
 * §4.1/§5.9 — the pure tier of this component's fractal split (requirements
 * §7.2.1, docs/CONVENTIONS.md): no React, no telescope imports. The
 * highest-priority tier of the testing pyramid (requirements §7.5) — see
 * __tests__/useNewGamePanelDomain.test.ts.
 *
 * Holds §4.1's board-size spec (the six selectable sizes, the first-open
 * default, the size→dimension rule) as pure functions the state and action
 * tiers curry: the rule's whole content is "for `size >= 8` the dimension is
 * forced to 3; for `size < 8` it is left unchanged" — asymmetric by design,
 * and `base` is not part of the rule at all, because the size selector never
 * changes it.
 */

/**
 * §4.1 — the six selectable board sizes, in select order: 4×4, 6×6, 8×8,
 * 9×9, 12×12, 16×16 — no more and no fewer (requirements §4.1, §8.2's)
 */
export const BOARD_SIZES: readonly number[] = [4, 6, 8, 9, 12, 16];

/** §5.9 — the Board Size select's first-open default: 8×8. */
export const DEFAULT_BOARD_SIZE = 8;

/** §4.1 — the default dimension when no prior value exists. */
export const DEFAULT_DIMENSION = 2;

/** §4.1 — the smallest board size whose selection forces the dimension. */
export const FORCED_DIMENSION_MIN_SIZE = 8;

/** §4.1 — the dimension every `size >= 8` selection is forced to. */
export const FORCED_DIMENSION = 3;

/**
 * §4.1 — the panel's initial dimension: the shell's currently-held value
 * (the "prior value" — what the running game's `scalars.dimension` is), or
 * `DEFAULT_DIMENSION` when no prior value exists. In the shell's typed
 * preferences a prior value always exists; the fallback carries §4.1's
 * "default `dimension` is `2`" clause forward unchanged.
 */
export function initialDimension(prior: number | undefined): number {
  return prior ?? DEFAULT_DIMENSION;
}

/**
 * §4.1 — the size→dimension rule, applied to a Board Size selection. For
 * `size >= FORCED_DIMENSION_MIN_SIZE` the dimension is forced to
 * `FORCED_DIMENSION`; for `size < FORCED_DIMENSION_MIN_SIZE` it is left
 * unchanged from the value the panel currently holds — "carry this exact
 * rule forward even though it looks asymmetric; it is what the original
 * does" (requirements §4.1). The result carries the newly selected `size`
 * alongside; `base` has no place in it, because the size selector never
 * changes it.
 */
export function selectBoardSize(
  heldDimension: number,
  size: number,
): NewGamePanelSelection {
  return {
    size,
    dimension:
      size >= FORCED_DIMENSION_MIN_SIZE ? FORCED_DIMENSION : heldDimension,
  };
}
