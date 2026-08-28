import { useMemo, useState } from "react";
import { Lens } from "telescopejs";
import type { Telescope } from "telescopejs";
import { isSamePiece } from "../../game/entities";
import type { Piece } from "../../game/entities";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types.ts";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type { HelpPanelPieceEntry, HelpPanelState } from "./HelpPanel.types.ts";
import {
  candidateSpaceFor,
  HELP_PIECE_IMAGE_PX,
  invalidNeighborSetFor,
  pieceLabel,
  validNeighborSetFor,
} from "./useHelpPanelDomain.ts";

/**
 * The internal (state-tier) shape `useHelpPanelState` returns to the
 * orchestrator (`useHelpPanelViewModel`) and the action tier
 * (`useHelpPanelActions`) — includes the selection setter, which the
 * orchestrator strips before the public view model reaches `RenderHelpPanel`
 * (docs/CONVENTIONS.md split-hook rule: component-external consumers only
 * ever see public state).
 */
export interface HelpPanelStateInternal {
  /** §5.10 item 1: the full candidate space (piece values, pool order). */
  readonly candidatePieces: readonly Piece[];
  /** The candidate space in its rendered form (one entry per piece). */
  readonly candidateEntries: readonly HelpPanelPieceEntry[];
  /** §5.10: the selected piece — `null` is the no-selection (placeholder) state. */
  readonly selectedPiece: Piece | null;
  /** §5.10 item 2: the valid-neighbor set of the selected piece, rendered. */
  readonly validEntries: readonly HelpPanelPieceEntry[];
  /** §5.10 item 3: the candidate space minus the valid set, rendered. */
  readonly invalidEntries: readonly HelpPanelPieceEntry[];
  readonly setSelectedPiece: (piece: Piece | null) => void;
}

/** The shared empty set of the no-selection state (one reference, never a fresh array per render). */
const NO_PIECES: readonly Piece[] = [];

/**
 * The state tier of Phase 18's non-trivial split (requirements §7.2.1,
 * docs/CONVENTIONS.md): the panel's one piece of local, non-telescope UI
 * state — the piece selector's selection — plus the three piece sets
 * (candidate space, valid neighbors, invalid neighbors) derived from it via
 * the pure domain tier.
 *
 * The selection is component-local on purpose: no `AppState` field moves
 * with it (opening the help drawer or inspecting a piece changes no
 * preference, no game), so it stays out of the shell telescope exactly like
 * the shell's own drawer open/closed flags — it starts `null` ("no piece
 * selected by default") and the empty/placeholder rendering is a pure
 * projection of that, never an unhandled `undefined`.
 */
export function useHelpPanelState(
  props: Readonly<TelescopedProps<HelpPanelState>>,
): HelpPanelStateInternal {
  const { base, dimension } = props.state;

  const [rawSelection, setSelectedPiece] = useState<Piece | null>(null);

  // §5.10 item 1: the full candidate space — every `base^dimension` piece,
  // Phase 2's interned pool in pool order.
  const candidatePieces = useMemo(
    () => candidateSpaceFor(dimension, base),
    [base, dimension],
  );

  // A selection must not outlive the candidate space it belongs to: when the
  // shell's `base`/`dimension` move (the §4.1 New Game rebuild, Phase 17), a
  // piece picked in the old space is no longer a member of the new one —
  // derive the effective selection synchronously during render rather than
  // resetting it in a post-paint effect, which would leave the render
  // triggered by the slice move computing both neighbor sets from the stale
  // selection (the "two sets partition the candidate space" invariant
  // visibly violated for one painted frame, and the selector showing a label
  // matching no option). Membership is by value (`isSamePiece`), not
  // reference: the pool is interned per `buildPiecePool` call, so a
  // stale-space piece never shares a reference with the new pool (§8.7,
  // `useHelpPanelDomain.ts`). The derived value is referentially stable
  // (`rawSelection` itself, or `null`), so it cannot invalidate the memos
  // below on unrelated re-renders.
  const selectedPiece =
    rawSelection === null ||
    !candidatePieces.some((piece) => isSamePiece(piece, rawSelection))
      ? null
      : rawSelection;

  // §5.10 item 2: the selected piece's valid-neighbor set — the pure domain
  // tier's `buildPossibleNeighbors` with no exclusions. No selection → the
  // shared empty set.
  const validPieces = useMemo(
    () =>
      selectedPiece === null
        ? NO_PIECES
        : validNeighborSetFor(selectedPiece, base),
    [selectedPiece, base],
  );

  // §5.10 item 3: the candidate space minus the valid set — the two sets
  // partition the candidate space by construction (no overlap, no
  // omissions). No selection → the shared empty set.
  const invalidPieces = useMemo(
    () =>
      selectedPiece === null
        ? NO_PIECES
        : invalidNeighborSetFor(candidatePieces, validPieces),
    [selectedPiece, candidatePieces, validPieces],
  );

  // Each set's rendered form: one entry per piece, each carrying its own
  // magnified piece-image slice for the shared Phase 6 `PieceDisplay` —
  // the §7.2 parent→child flow (the tray column's / cell tooltip's
  // piece-image convention).
  const candidateEntries = useMemo(
    () => candidatePieces.map((piece) => toPieceEntry(piece, props.telescope)),
    [candidatePieces, props.telescope],
  );
  const validEntries = useMemo(
    () => validPieces.map((piece) => toPieceEntry(piece, props.telescope)),
    [validPieces, props.telescope],
  );
  const invalidEntries = useMemo(
    () => invalidPieces.map((piece) => toPieceEntry(piece, props.telescope)),
    [invalidPieces, props.telescope],
  );

  return {
    candidatePieces,
    candidateEntries,
    selectedPiece,
    validEntries,
    invalidEntries,
    setSelectedPiece,
  };
}

/** One set member's rendered form: the value, its digit label, its image slice. */
function toPieceEntry(
  piece: Piece,
  telescope: Telescope<HelpPanelState>,
): HelpPanelPieceEntry {
  return {
    piece,
    label: pieceLabel(piece),
    image: {
      state: { piece, size: HELP_PIECE_IMAGE_PX },
      telescope: telescope.magnify(pieceImageLens(piece)),
    },
  };
}

/** `HelpPanelState` → the piece-image slice one entry's `PieceDisplay` renders. */
function pieceImageState(piece: Piece): PieceDisplayState {
  return { piece, size: HELP_PIECE_IMAGE_PX };
}

/**
 * The magnification focusing this panel's telescope down to the piece image
 * one entry renders. Same deliberate asymmetry as the tray's and the cell
 * tooltip's piece-image lenses: the piece value is an immutable domain value
 * and the render size is a panel-level layout constant, so no field of this
 * slice can ever change — writes through it return the parent slice
 * unchanged (identity no-op) and the magnified stream simply mirrors.
 */
function pieceImageLens(piece: Piece): Lens<HelpPanelState, PieceDisplayState> {
  return new Lens(
    () => pieceImageState(piece),
    (_pieceImage, state) => state,
  );
}
