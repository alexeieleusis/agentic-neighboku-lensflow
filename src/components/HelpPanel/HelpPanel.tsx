import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent.ts";
import type {
  HelpPanelPieceEntry,
  HelpPanelState,
  HelpPanelViewModel,
} from "./HelpPanel.types.ts";
import { useHelpPanelViewModel } from "./useHelpPanelViewModel.ts";
import { PieceDisplay } from "../PieceDisplay/PieceDisplay.tsx";
import {
  ENGLISH_TUTORIAL_VIDEO_LABEL,
  ENGLISH_TUTORIAL_VIDEO_URL,
  FREPIK_ATTRIBUTION_LABEL,
  FREPIK_ATTRIBUTION_URL,
  NO_SELECTION_LABEL,
  SPANISH_TUTORIAL_VIDEO_LABEL,
  SPANISH_TUTORIAL_VIDEO_URL,
} from "./useHelpPanelDomain.ts";

/**
 * §5.10 (Phase 18) — the help panel: the content of the shell's top drawer
 * (the drawer chrome itself is the shell's, in `App.tsx`'s
 * `RenderHelpDrawer`). Fractal component: `state,telescope →
 * useHelpPanelViewModel → RenderHelpPanel` (requirements §7.2).
 *
 * The `state` here is the shell's `{ base, dimension, pieceType }` slice —
 * the candidate space the panel's piece sets are built on, plus the §4.2 skin
 * preference its piece displays render in (Phase 19, §5.4: each piece entry's
 * magnified `PieceDisplay` slice forwards this `pieceType`, so the Preferences
 * panel's Shapes/Faces toggle reaches this panel's selector and neighbor-set
 * displays) — handed over as a magnified telescope (App → `HelpPanel`, §7.2).
 * The slice is read-only from the panel's point of view (`HELP_PANEL_LENS`'s
 * setter is the identity): every piece it renders reads its own value off a
 * dedicated magnified piece-image slice, and the one user interaction — the
 * piece selector's choice — commits to the panel's LOCAL selection state tier,
 * never through the slice's telescope.
 *
 * The panel is the feature the tutorial video describes as "select any piece…
 * the app will visually show which other pieces can be its neighbors": the
 * §5.10 item 1/2/3 triple — the piece selector, the valid-neighbor group, the
 * invalid-neighbor group — plus the two static tutorial-video links and the
 * unconditional Freepik face-image credit (§5.4).
 */
export const HelpPanel: TelescopeComponent<HelpPanelState> = (
  props: TelescopedProps<HelpPanelState>,
): React.ReactElement => {
  const viewModel = useHelpPanelViewModel(props);
  return RenderHelpPanel(viewModel);
};

/* -------------------------------------------------------------------------- */
/* RenderHelpPanel                                                            */
/* -------------------------------------------------------------------------- */

/**
 * §5.10: the six sections in the spec's exact order — (1) the piece selector,
 * (2) the valid-neighbor group, (3) the invalid-neighbor group, (4) the
 * English tutorial link, (5) the Spanish tutorial link, (6) the Freepik
 * attribution. Pure projection of the view model: no state, no commit logic —
 * each control's handler already carries its own commit.
 */
function RenderHelpPanel(
  viewModel: Readonly<HelpPanelViewModel>,
): React.ReactElement {
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {/* §5.10 item 1: the piece selector — every candidate piece, rendered via the shared PieceDisplay. */}
      <Select
        label="Piece"
        value={viewModel.selectedLabel}
        displayEmpty
        onChange={(event) =>
          viewModel.onPieceSelect(String(event.target.value))
        }
        sx={{ width: 240 }}
      >
        <MenuItem value="">{NO_SELECTION_LABEL}</MenuItem>
        {viewModel.candidatePieces.map((entry) => (
          <MenuItem key={entry.label} value={entry.label} dense>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PieceDisplay
                state={entry.image.state}
                telescope={entry.image.telescope}
              />
              <Typography variant="body2">{entry.label}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Select>

      {/*
       * §8.1 (diagonal-neighbors discrepancy — FLAGGED FOR HUMAN REVIEW):
       * these two groupings are this panel's in-app statement of the
       * neighbor rule. They are computed from Phase 2's
       * `buildPossibleNeighbors` (via the panel's domain tier), which — per
       * §8.1's rebuild decision — replicates the CODE's orthogonal-only
       * behavior: a piece's valid neighbors are the pieces sharing exactly
       * one attribute with it, the way the shipped game plays. The original
       * in-app doc (`src/neighboku.md`) and the tutorial video instead
       * describe the rule as applying to the diagonal cells too. Which
       * wording (if any) in-app help text should use — "diagonal",
       * "orthogonal", or nothing — is an OPEN decision for the human
       * reviewer; this phase deliberately neither picks nor edits wording,
       * and the behavior stays orthogonal-only either way.
       */}
      {/* §5.10 item 2: the valid-neighbor group — `buildPossibleNeighbors` with no exclusions. */}
      <RenderNeighborGroup
        icon={<CheckCircleIcon color="success" />}
        title="Valid neighbors"
        entries={viewModel.validNeighbors}
      />
      {/* §5.10 item 3: the candidate space minus the valid set — disjoint from, and jointly exhaustive with, the group above. */}
      <RenderNeighborGroup
        icon={<BlockIcon color="error" />}
        title="Invalid neighbors"
        entries={viewModel.invalidNeighbors}
      />

      {/* §5.10 items 4–6: the two tutorial-video links (static, separately labeled) and the Freepik face-image credit — the credit renders unconditionally, it is not gated on `pieceType` (the panel does not read that preference at all). */}
      <Stack spacing={0.5}>
        <Link
          href={ENGLISH_TUTORIAL_VIDEO_URL}
          target="_blank"
          rel="noreferrer"
          sx={{ display: "inline-block" }}
        >
          {ENGLISH_TUTORIAL_VIDEO_LABEL}
        </Link>
        <Link
          href={SPANISH_TUTORIAL_VIDEO_URL}
          target="_blank"
          rel="noreferrer"
          sx={{ display: "inline-block" }}
        >
          {SPANISH_TUTORIAL_VIDEO_LABEL}
        </Link>
        <Link
          href={FREPIK_ATTRIBUTION_URL}
          target="_blank"
          rel="noreferrer"
          color="text.secondary"
          sx={{ display: "inline-block" }}
        >
          {FREPIK_ATTRIBUTION_LABEL}
        </Link>
      </Stack>
    </Stack>
  );
}

/**
 * One §5.10 neighbor group: its distinct icon ("valid neighbors" vs.
 * "invalid neighbors", so the two groupings stay visually distinguishable),
 * its heading, and its members — each rendered via the shared Phase 6
 * `PieceDisplay` off its own magnified piece-image slice. An empty group is
 * the no-selection placeholder, not a hole: the "Select a piece…" prompt is
 * the sensible empty state §5.10 asks for (never a crash, never an unhandled
 * `undefined`).
 */
function RenderNeighborGroup(props: {
  readonly icon: React.ReactElement;
  readonly title: string;
  readonly entries: readonly HelpPanelPieceEntry[];
}): React.ReactElement {
  const { icon, title, entries } = props;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {icon}
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {NO_SELECTION_LABEL} to see its {title.toLowerCase()}
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {entries.map((entry) => (
            <PieceDisplay
              key={entry.label}
              state={entry.image.state}
              telescope={entry.image.telescope}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
