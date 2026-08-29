import type { Piece } from "../../game/entities";
import type { PieceType } from "../CellDisplay/CellDisplay.types.ts";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types.ts";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";

/**
 * §5.10 (Phase 18) — the state slice this component reads: the current candidate
 * space's `base`/`dimension` (a read-only projection of the shell's §4.2
 * `preferences.scalars`), plus — since Phase 19 (§5.4) — the shell's §4.2
 * `pieceType` skin preference. The panel is a pure view over those scalars — the
 * selected piece is component-local UI state (the `useHelpPanelState` tier), never
 * part of this slice, so nothing is ever written through the slice's telescope:
 * `HELP_PANEL_LENS`'s setter (`useAppViewModel.ts`) is the identity no-op, exactly
 * like the board/tray/solvability slices. `pieceType` rides the slice so the
 * panel's piece entries can forward it into their shared `PieceDisplay` slices:
 * the §5.4 mode switch then reaches this panel's selector and neighbor-set
 * displays the same way it reaches the board's and the tray's.
 */
export interface HelpPanelState {
  readonly base: number;
  readonly dimension: number;
  /** §4.2/§5.4 (Phase 19): the skin the panel's piece displays render in. */
  readonly pieceType: PieceType;
}

/**
 * §5.10 — one rendered member of a piece set (the piece selector's options, the
 * valid-neighbor group, the invalid-neighbor group): the piece value (the set's
 * membership key and the option's digit label), a human-readable label, and the
 * slice handed to the shared Phase 6 `PieceDisplay` — the §7.2 parent→child flow
 * into the shared piece renderer, the same shape as the tray column's and the
 * cell tooltip's piece-image slices. The panel renders every piece through this
 * one shared component; it builds no second piece-rendering path.
 */
export interface HelpPanelPieceEntry {
  readonly piece: Piece;
  readonly label: string;
  readonly image: TelescopedProps<PieceDisplayState>;
}

/** Everything `RenderHelpPanel` needs, precomputed by `useHelpPanelViewModel`. */
export interface HelpPanelViewModel {
  /**
   * §5.10 item 1: the piece selector's options — the full candidate space, every
   * `base^dimension` piece, in pool order.
   */
  readonly candidatePieces: readonly HelpPanelPieceEntry[];
  /** §5.10: the selected piece — `null` is the no-selection (placeholder) state. */
  readonly selectedPiece: Piece | null;
  /**
   * The closed Select's displayed value: the selected piece's digit label, or
   * `""` (with the selector's `displayEmpty`) in the no-selection state.
   */
  readonly selectedLabel: string;
  /**
   * §5.10 item 2: the pieces that ARE valid neighbors of the selected piece —
   * Phase 2's `buildPossibleNeighbors` with no exclusions; empty while no piece
   * is selected.
   */
  readonly validNeighbors: readonly HelpPanelPieceEntry[];
  /**
   * §5.10 item 3: the full candidate space minus the valid set — every remaining
   * piece, including the selected piece itself (a piece is never its own valid
   * neighbor); empty while no piece is selected. Together with
   * {@link HelpPanelViewModel.validNeighbors} the two sets partition the whole
   * candidate space: no overlap, no omissions.
   */
  readonly invalidNeighbors: readonly HelpPanelPieceEntry[];
  /**
   * §5.10 item 1: the piece selector's `onChange` (the action tier) — curries the
   * domain's label→piece resolution with the current candidate space and commits
   * the result to the state tier's local selection.
   */
  readonly onPieceSelect: (label: string) => void;
}
