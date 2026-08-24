import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import UndoIcon from "@mui/icons-material/Undo";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type { UndoButtonState, UndoButtonViewModel } from "./UndoButton.types";
import { useUndoButtonViewModel } from "./useUndoButtonViewModel";

/**
 * §5.7 — the top bar's Undo control: an icon button, disabled iff no move has
 * been placed yet. This component is the UI-level guard for Phase 3's
 * unguarded `undoPlay` (requirements §8.4): the disabled-when-empty rule lives
 * here, and only here — the move engine performs no empty-history check.
 */
export const UndoButton: TelescopeComponent<UndoButtonState> = function (
  props: TelescopedProps<UndoButtonState>,
): React.ReactElement {
  return RenderUndoButton(useUndoButtonViewModel(props));
};

function RenderUndoButton(
  viewModel: Readonly<UndoButtonViewModel>,
): React.ReactElement {
  return viewModel.disabled ? (
    // No Tooltip wrapper while disabled: the button has no hover surface,
    // and MUI warns on a disabled button inside a Tooltip.
    <IconButton size="small" aria-label="Undo" disabled>
      <UndoIcon />
    </IconButton>
  ) : (
    <Tooltip title="Undo">
      <IconButton size="small" aria-label="Undo" onClick={viewModel.undo}>
        <UndoIcon />
      </IconButton>
    </Tooltip>
  );
}
