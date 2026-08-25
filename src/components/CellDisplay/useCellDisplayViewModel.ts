import type { TelescopedProps } from "../../base/TelescopeComponent";
import type {
  CellDisplayState,
  CellDisplayViewModel,
} from "./CellDisplay.types";
import {
  cssGridLine,
  pieceLabelFor,
  sectionColorFor,
} from "./useCellDisplayDomain";
import { useCellDisplayState } from "./useCellDisplayState";
import { useCellDisplayActions } from "./useCellDisplayActions";

/**
 * The orchestrator (requirements §7.2.1, Phase 12): wiring only, no derivations of its
 * own. The §5.6 droppable registration and the §5.2 hover/tap reveal state plus the
 * fit-hint derivations live in `useCellDisplayState`; the three user-interaction
 * handlers live in `useCellDisplayActions`; every pure cell derivation (1-indexed grid
 * lines, the placeholder label, the section fill, and the fit-count/tooltip gates)
 * lives in `useCellDisplayDomain`. This hook just composes the tiers and strips the
 * internals' setters from the public view model.
 */
export function useCellDisplayViewModel(
  props: Readonly<TelescopedProps<CellDisplayState>>,
): CellDisplayViewModel {
  const { size, row, col, piece, pieceType } = props.state;
  const internals = useCellDisplayState(props);
  const actions = useCellDisplayActions(internals);

  return {
    gridRow: cssGridLine(row),
    gridColumn: cssGridLine(col),
    backgroundColor: sectionColorFor(row, col, size),
    piece,
    pieceLabel: pieceLabelFor(piece),
    pieceType,
    droppableNodeRef: internals.droppableNodeRef,
    isOver: internals.isOver,
    fitCount: internals.fitCount,
    fitCountVisible: internals.fitCountVisible,
    fitPiecesTooltipOpen: internals.fitPiecesTooltipOpen,
    fitPieceImages: internals.fitPieceImages,
    onCellMouseEnter: actions.onCellMouseEnter,
    onCellMouseLeave: actions.onCellMouseLeave,
    onCellTap: actions.onCellTap,
  };
}
