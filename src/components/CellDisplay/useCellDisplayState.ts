import { useCallback, useEffect, useMemo, useState } from "react";
import { Lens } from "telescopejs";
import { useDroppable } from "@dnd-kit/core";
import type { Piece } from "../../game/entities";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type { CellDisplayState, PieceType } from "./CellDisplay.types";
import {
  CELL_PIECE_IMAGE_PX,
  FIT_PIECE_IMAGE_PX,
  cellDroppableId,
  fitCountHintIsOn,
  fitPieceCountForCell,
  fitPiecesForCell,
  fitPiecesTooltipIsOn,
} from "./useCellDisplayDomain";

/**
 * Split tier (requirements §7.2.1, Phase 12): the cell's local, non-telescope UI state
 * — the §5.2 tooltip's two reveal inputs (desktop pointer hover, tap/click pin) — plus
 * the §5.6 droppable registration and the values the pure `useCellDisplayDomain`
 * functions derive from the state slice.
 *
 * The shape is INTERNAL: it carries the setters the action tier commits the
 * interactions through; the view-model orchestrator strips the setters before the
 * public view model reaches `RenderCellDisplay` (docs/CONVENTIONS.md scale rule).
 *
 * `isOver`, `fitCountVisible`, and `fitPiecesTooltipOpen` are independent derived
 * gates, not parallel states of one widget — a blank cell with both hint prefs on
 * shows the fit-count badge and the open tooltip at once, and a piece hovering the
 * cell is orthogonal to both — so they stay parallel booleans rather than a
 * discriminated union (UC13 “When Not to Use It”: independent simple flags); the
 * only stored state here is `hovered`/`tapped`, the two reveal inputs of the one
 * hint.
 */
// eslint-disable-next-line lensflow/no-parallel-boolean-state-flags
export interface CellDisplayInternals {
  readonly droppableNodeRef: (element: HTMLElement | null) => void;
  readonly isOver: boolean;
  readonly fitCount: number;
  readonly fitCountVisible: boolean;
  readonly fitPiecesTooltipOpen: boolean;
  readonly fitPieceImages: readonly TelescopedProps<PieceDisplayState>[];
  /** The filled cell's own piece-image slice; `null` while the cell is blank. */
  readonly pieceImage: TelescopedProps<PieceDisplayState> | null;
  readonly setHovered: (hovered: boolean) => void;
  readonly setTapped: (tapped: boolean) => void;
  readonly toggleTapped: () => void;
}

export function useCellDisplayState(
  props: Readonly<TelescopedProps<CellDisplayState>>,
): CellDisplayInternals {
  const {
    size,
    pieceType,
    row,
    col,
    piece,
    cellToFitPieces,
    hintFitPieceCount,
    showFitPiecesOnHover,
  } = props.state;

  // The §5.6 droppable registration: id `cell-{row}-{col}`, live only while the cell is
  // blank. `useDroppable` registers with the nearest ANCESTOR DndContext via React
  // context (docs/CONVENTIONS.md dnd-kit note) — this cell always has one: the
  // shell-level `<DndContext>` that `App` constructs.
  const droppable = useDroppable({
    id: cellDroppableId(row, col),
    disabled: piece !== null,
  });

  // Local §5.2 reveal state (requirements §7.2.1: local, non-telescope UI state).
  // `hovered` — the desktop pointer is over the cell (enter/leave driven).
  // `tapped`  — the tap/click pin; toggled, so on a touch viewport the user reveals the
  //             tooltip by tapping the cell and dismisses it by tapping it again.
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);

  // The reveal state must not outlive the cell's occupancy. This component instance
  // survives the cell's piece transitions (`RowDisplay` keys its cells by `col`), and
  // the cell root's `onClick` commits a pin on a FILLED cell too — invisible there,
  // because `fitPiecesTooltipIsOn` needs `piece === null`. When such a cell next
  // blanks (an `undoPlay`, or a later phase's click-to-remove), the stale pin would
  // otherwise open the tooltip with no pointer over the cell and no tap that belongs
  // to its blank state. Reset both flags on any `piece` reference change — the board
  // keeps its pieces by interned pool reference, so this fires only on a real
  // occupancy change, and a pointer already resting on the cell as it blanks simply
  // re-enters.
  useEffect(() => {
    setHovered(false);
    setTapped(false);
  }, [piece]);

  const fitPieces = useMemo(
    () => fitPiecesForCell(cellToFitPieces, size, row, col),
    [cellToFitPieces, size, row, col],
  );
  const fitCount = fitPieceCountForCell(cellToFitPieces, size, row, col);
  const fitCountVisible = fitCountHintIsOn(piece, hintFitPieceCount);
  const fitPiecesTooltipOpen =
    fitPiecesTooltipIsOn(piece, showFitPiecesOnHover, fitCount) &&
    (hovered || tapped);

  // §7.2 parent→child flow into the shared piece renderer: one magnified
  // piece-image slice per piece the tooltip lists. Same shape as the tray's column
  // slices (`useAvailablePiecesTrayState.ts`). Phase 19 (§5.4): the slice also
  // carries this cell's board-wide `pieceType`, so a Preferences skin toggle
  // re-derives these thumbnails and the board's piece displays switch
  // Shapes↔Faces on the same emission.
  const fitPieceImages = useMemo(
    () =>
      fitPieces.map((fitPiece) => ({
        state: pieceImageState(fitPiece, pieceType, FIT_PIECE_IMAGE_PX),
        telescope: props.telescope.magnify(
          pieceImageLens(fitPiece, FIT_PIECE_IMAGE_PX),
        ),
      })),
    [fitPieces, pieceType, props.telescope],
  );

  // The filled cell's own piece, at the cell's (larger) piece scale: the same
  // §7.2 magnified slice shape, `null` while blank. The board keeps its pieces by
  // interned pool reference, so the `piece` reference identity tracks occupancy —
  // the slice re-derives on a real occupancy change and on a `pieceType` toggle.
  const pieceImage = useMemo(
    () =>
      piece === null
        ? null
        : {
            state: pieceImageState(piece, pieceType, CELL_PIECE_IMAGE_PX),
            telescope: props.telescope.magnify(
              pieceImageLens(piece, CELL_PIECE_IMAGE_PX),
            ),
          },
    [piece, pieceType, props.telescope],
  );

  const toggleTapped = useCallback(
    () => setTapped((wasTapped) => !wasTapped),
    [setTapped],
  );

  return {
    droppableNodeRef: droppable.setNodeRef,
    isOver: piece === null && droppable.isOver,
    fitCount,
    fitCountVisible,
    fitPiecesTooltipOpen,
    fitPieceImages,
    pieceImage,
    setHovered,
    setTapped,
    toggleTapped,
  };
}

/** `CellDisplayState` fields → the piece-image slice one `PieceDisplay` renders at `sizePx`. */
function pieceImageState(
  piece: Piece,
  pieceType: PieceType,
  sizePx: number,
): PieceDisplayState {
  return { piece, size: sizePx, pieceType };
}

/**
 * The magnification focusing this cell's telescope down to the piece image one of this
 * cell's `PieceDisplay`s renders (the filled piece or one tooltip entry). Same
 * deliberate asymmetry as the tray's `pieceImageLens`
 * (`useAvailablePiecesTrayState.ts`): the pieces are immutable domain values and the
 * render size is a component constant, so the only field of this slice that can move
 * is `pieceType` — and it moves only as the shell's §4.2 preference does (Phase 19,
 * §5.4), re-projected by this getter from the cell slice. Writes through it are the
 * identity no-op.
 */
function pieceImageLens(
  piece: Piece,
  sizePx: number,
): Lens<CellDisplayState, PieceDisplayState> {
  return new Lens(
    (cellState) => pieceImageState(piece, cellState.pieceType, sizePx),
    (_pieceImage, cellState) => cellState,
  );
}
