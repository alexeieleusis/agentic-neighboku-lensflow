import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type {
  CounterDisplayState,
  CounterDisplayViewModel,
} from "./CounterDisplay.types";
import { useCounterDisplayViewModel } from "./useCounterDisplayViewModel";

export const CounterDisplay: TelescopeComponent<CounterDisplayState> =
  function (props: TelescopedProps<CounterDisplayState>): React.ReactElement {
    return RenderCounterDisplay(useCounterDisplayViewModel(props));
  };

function RenderCounterDisplay(
  viewModel: Readonly<CounterDisplayViewModel>,
): React.ReactElement {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Typography variant="body1">Count: {viewModel.count}</Typography>
      <Button variant="contained" onClick={viewModel.increment}>
        Increment
      </Button>
    </Stack>
  );
}
