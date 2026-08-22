import Box from "@mui/material/Box";
import type {
  TelescopeComponent,
  TelescopedProps,
} from "../../base/TelescopeComponent";
import type { RowDisplayState, RowDisplayViewModel } from "./RowDisplay.types";
import { useRowDisplayViewModel } from "./useRowDisplayViewModel";
import { CellDisplay } from "../CellDisplay/CellDisplay";

/**
 * §5.2 — one board row ("one row per board row"). The row itself takes no layout box
 * (`display: contents`), so its `CellDisplay` children are the direct grid items of
 * `BoardDisplay`'s grid and position themselves via their own `gridRow`/`gridColumn`.
 */
export const RowDisplay: TelescopeComponent<RowDisplayState> = function (
  props: TelescopedProps<RowDisplayState>,
): React.ReactElement {
  return RenderRowDisplay(useRowDisplayViewModel(props));
};

function RenderRowDisplay(
  viewModel: Readonly<RowDisplayViewModel>,
): React.ReactElement {
  return (
    <Box sx={{ display: "contents" }}>
      {viewModel.cells.map((cell) => (
        <CellDisplay key={cell.state.col} {...cell} />
      ))}
    </Box>
  );
}
