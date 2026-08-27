import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent.ts";
import type {
  PreferencesDisplayState,
  PreferencesDisplayViewModel,
  PreferencesDisplaySwitchRow,
  PreferencesDisplaySegmentedRow,
} from "./PreferencesDisplay.types.ts";
import { usePreferencesDisplayViewModel } from "./usePreferencesDisplayViewModel.ts";

/**
 * §5.8 — the preferences panel: the 9-row content of the shell's bottom drawer
 * (the drawer chrome itself is the shell's, in `App.tsx`'s
 * `RenderPreferencesDrawer`). Fractal component: `state,telescope →
 * usePreferencesDisplayViewModel → RenderPreferencesDisplay` (requirements §7.2).
 *
 * The `state` here is the shell's §4.2 `AppPreferences` slice, handed over as a
 * magnified telescope (App → `PreferencesDisplay`, §7.2): every one of the 9
 * controls reads its own value off `state` and commits its change back through
 * the slice's telescope — never through a raw callback prop — so the change
 * lands on `AppState.preferences` (the `PREFERENCES_LENS` setter) and persists
 * through `main.tsx`'s per-emission subscription (§4.3) without this component
 * touching `localStorage` at all.
 */
export const PreferencesDisplay: TelescopeComponent<PreferencesDisplayState> = (
  props: TelescopedProps<PreferencesDisplayState>,
): React.ReactElement => {
  const viewModel = usePreferencesDisplayViewModel(props);
  return RenderPreferencesDisplay(viewModel);
};

/* -------------------------------------------------------------------------- */
/* RenderPreferencesDisplay                                                   */
/* -------------------------------------------------------------------------- */

/**
 * §5.8: the 9 rows in the view model's exact table order — the `pieceType`
 * row first (a two-option "Shapes"/"Faces" choice, rendered as a horizontally
 * laid-out `RadioGroup` per §5.8's correction note: `pieceType` is a string
 * value, not a boolean, so a `Switch` cannot represent it), then the 8
 * `Switch` rows, one per remaining preference. Pure projection of the view
 * model: no state, no commit logic — each row's `onChange` closure already
 * carries its own commit.
 */
function RenderPreferencesDisplay(
  viewModel: Readonly<PreferencesDisplayViewModel>,
): React.ReactElement {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {viewModel.rows.map((row) =>
        row.kind === "switch" ? (
          <RenderSwitchRow key={row.label} row={row} />
        ) : (
          <RenderSegmentedRow key={row.label} row={row} />
        ),
      )}
    </Stack>
  );
}

/** One §5.8 boolean row: a MUI `Switch` labelled with the table's exact text. */
function RenderSwitchRow(props: {
  readonly row: PreferencesDisplaySwitchRow;
}): React.ReactElement {
  const { row } = props;
  return (
    <FormControlLabel
      control={
        <Switch
          checked={row.checked}
          onChange={(event) => row.onChange(event.target.checked)}
        />
      }
      label={row.label}
    />
  );
}

/**
 * The §5.8 `pieceType` row: the table's label plus the two-option choice
 * ("Shapes"/"Faces") laid out horizontally. Each option's `onChange` curries
 * the row's commit with that option's value — no `event.target.value` cast —
 * and the controlled `RadioGroup` value keeps the checked radio in lockstep
 * with the slice until the commit lands.
 */
function RenderSegmentedRow(props: {
  readonly row: PreferencesDisplaySegmentedRow;
}): React.ReactElement {
  const { row } = props;
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Typography variant="body2" id="preferences-display-piece-type">
        {row.label}
      </Typography>
      <RadioGroup
        row
        aria-labelledby="preferences-display-piece-type"
        value={row.value}
      >
        {row.options.map((option) => (
          <FormControlLabel
            key={option}
            value={option}
            control={
              <Radio size="small" onChange={() => row.onChange(option)} />
            }
            label={option}
          />
        ))}
      </RadioGroup>
    </Stack>
  );
}
