import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent.ts";
import type {
  NewGamePanelState,
  NewGamePanelViewModel,
} from "./NewGamePanel.types.ts";
import { useNewGamePanelViewModel } from "./useNewGamePanelViewModel.ts";

/**
 * §5.9 — the New Game panel: the content of the shell's bottom drawer (the
 * drawer chrome itself is the shell's, in `App.tsx`'s
 * `RenderNewGameDrawer`). Fractal component: `state,telescope →
 * useNewGamePanelViewModel → RenderNewGamePanel` (requirements §7.2).
 *
 * The `state` here is the shell's §4.2 `scalars` plus the §5.13/§5.9 game
 * clock origin, handed over as a magnified telescope (App → `NewGamePanel`,
 * §7.2): the Board Size select's changes stay LOCAL to this panel (§4.1's
 * size→dimension rule, the state tier), and the Start button's single
 * commit writes the selected scalars and a fresh `startTime` back through
 * the slice's telescope — the `NEW_GAME_PANEL_LENS` setter rebuilds the
 * board (Phase 2), unfolds a fresh puzzle (Phase 3), resets
 * `gamePlay.startTime`, and closes the panel (§5.9) — so the panel owns no
 * drawer open/closed state of its own and commits no board/game state
 * directly.
 */
export const NewGamePanel: TelescopeComponent<NewGamePanelState> = (
  props: TelescopedProps<NewGamePanelState>,
): React.ReactElement => {
  const viewModel = useNewGamePanelViewModel(props);
  return RenderNewGamePanel(viewModel);
};

/* -------------------------------------------------------------------------- */
/* RenderNewGamePanel                                                         */
/* -------------------------------------------------------------------------- */

/**
 * §5.9: the panel's two controls — the single Board Size select (the six
 * §4.1 sizes, `4×4` … `16×16`, controlled by the view model's local
 * selection) and the Start button. Pure projection of the view model: no
 * state, no commit logic — each control's handler closure already carries
 * its own move (the select's local update, the Start commit).
 */
function RenderNewGamePanel(
  viewModel: Readonly<NewGamePanelViewModel>,
): React.ReactElement {
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="body2" id="new-game-panel-board-size">
          Board Size
        </Typography>
        <Select
          labelId="new-game-panel-board-size"
          value={viewModel.selectedSize}
          onChange={(event: SelectChangeEvent<number>) =>
            viewModel.onSizeChange(event.target.value)
          }
        >
          {viewModel.sizes.map((size) => (
            <MenuItem key={size} value={size}>
              {`${size}×${size}`}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Button variant="contained" onClick={viewModel.onStart}>
        Start
      </Button>
    </Stack>
  );
}
