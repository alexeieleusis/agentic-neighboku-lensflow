import { useCallback, useMemo, useState } from "react";
import { Lens } from "telescopejs";
import { useDroppable } from "@dnd-kit/core";
import type { Piece } from "../../game/entities";
import type { TelescopedProps } from "../../base/TelescopeComponent";
import type { PieceDisplayState } from "../PieceDisplay/PieceDisplay.types";
import type { CellDisplayState } from "./CellDisplay.types";
import {
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
 */
export interface CellDisplayInternals {
  readonly droppableNodeRef: (element: HTMLElement | null) => void;
  readonly isOver: boolean;
  readonly fitCount: number;
  readonly fitCountVisible: boolean;
  readonly fitPiecesTooltipOpen: boolean;
  readonly fitPieceImages: readonly TelescopedProps<PieceDisplayState>[];
  readonly setHovered: (hovered: boolean) => void;
  readonly setTapped: (tapped: boolean) => void;
  readonly toggleTapped: () => void;
}

export function useCellDisplayState(
  props: Readonly<TelescopedProps<CellDisplayState>>,
): CellDisplayInternals {
  const {
    size,
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
  // slices (`useAvailablePiecesTrayViewModel.ts`).
  const fitPieceImages = useMemo(
    () =>
      fitPieces.map((fitPiece) => ({
        state: { piece: fitPiece, size: FIT_PIECE_IMAGE_PX },
        telescope: props.telescope.magnify(pieceImageLens(fitPiece)),
      })),
    [fitPieces, props.telescope],
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
    setHovered,
    setTapped,
    toggleTapped,
  };
}

/**
 * The magnification focusing this cell's telescope down to the piece image one tooltip
 * entry renders. Same deliberate asymmetry as the tray's `pieceImageLens`
 * (`useAvailablePiecesTrayViewModel.ts`): the fit pieces are immutable domain values
 * from the shared Phase 3 cache and the render size is a component constant, so no
 * field of this slice can ever change — writes through it are the identity no-op.
 */
function pieceImageLens(
  piece: Piece,
): Lens<CellDisplayState, PieceDisplayState> {
  return new Lens(
    () => ({ piece, size: FIT_PIECE_IMAGE_PX }),
    (_pieceImage, cellState) => cellState,
  );
}
