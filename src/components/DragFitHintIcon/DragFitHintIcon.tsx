import InfoIcon from "@mui/icons-material/Info";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type { DragHint } from "../DraggablePiece/DraggablePiece.types";
import type { DragFitHintIconViewModel } from "./DragFitHintIcon.types";
import { useDragFitHintIconViewModel } from "./useDragFitHintIconViewModel";

/**
 * §5.6 (Phase 14) — the top bar's drag-fit hint icon: the READ end of the §5.6
 * DragHint channel. `state,telescope → useDragFitHintIconViewModel →
 * RenderDragFitHintIcon` (requirements §7.2); the state slice is the bare `DragHint`
 * value on its own dedicated magnified telescope (`App` → `DragFitHintIcon`, §7.2) —
 * the shell's drag-lifecycle monitor writes the hint through its own independent
 * magnification of the same lens, so this component never receives the hint as a raw
 * prop or callback and never writes it itself.
 *
 * Renders into the top-bar slot Phase 4 reserved for the drag-fit-hint icon
 * (`App`'s first top-bar element): exactly the three documented visual states —
 * the info icon for `None`/`Unknown`, the thumbs-up for `Ok`, the thumbs-down for
 * `NotOk` — with the Phase 4 slot tooltip kept on the element.
 */
export const DragFitHintIcon: TelescopeComponent<DragHint> = function (
  props: TelescopedProps<DragHint>,
): React.ReactElement {
  return RenderDragFitHintIcon(useDragFitHintIconViewModel(props));
};

function RenderDragFitHintIcon(
  viewModel: Readonly<DragFitHintIconViewModel>,
): React.ReactElement {
  // §5.6: the four hint values collapse onto the three documented icons — `None` and
  // `Unknown` both show the info icon (a drag not over a determinable target is
  // visually the same "undetermined" state).
  let icon: React.ReactElement;
  if (viewModel.hint === "Ok") {
    icon = <ThumbUpIcon />;
  } else if (viewModel.hint === "NotOk") {
    icon = <ThumbDownIcon />;
  } else {
    icon = <InfoIcon />;
  }

  return (
    <Tooltip title="Drag to place; right-click or swipe to rotate">
      <IconButton
        size="small"
        aria-label={viewModel.ariaLabel}
        aria-live="polite"
        sx={{ color: viewModel.color }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
