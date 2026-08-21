import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// @testing-library/react's auto-cleanup only hooks into the test runner when
// Vitest's `globals` mode is on; here it is off, so unmount explicitly.
afterEach(() => {
  cleanup();
});
import { Telescope } from "telescopejs";
import { BoardDisplay } from "../BoardDisplay";
import type { BoardDisplayState, BoardRow } from "../BoardDisplay.types";

/**
 * A `size × size` board whose rows are filled alternately: even rows carry the
 * constant piece [0,1,2], odd rows are blank. This exercises both the filled-cell
 * (piece placeholder) and blank-cell (droppable target) render branches through the
 * full Board → Row → Cell magnification chain, without a real `Game`.
 */
function buildBoardDisplayState(size: number): BoardDisplayState {
  const rows: BoardRow[] = Array.from({ length: size }, (_, row) => ({
    index: row,
    cells: Array.from({ length: size }, (_, col) => ({
      row,
      col,
      piece: row % 2 === 0 ? ([0, 1, 2] as const) : null,
    })),
  }));
  return { size, pieceType: "Shapes", rows };
}

describe("BoardDisplay", () => {
  it("renders one cell per board row/column, splitting blank vs filled", () => {
    const state = buildBoardDisplayState(6);
    const telescope = Telescope.of(state);
    const { container } = render(
      <BoardDisplay state={state} telescope={telescope} />,
    );

    expect(screen.getByText("Board (6×6)")).toBeTruthy();

    // 3 filled rows × 6 = 18 filled cells each expose a piece label.
    const filledCells = screen.getAllByRole("img");
    expect(filledCells.length).toBe(18);

    // 3 blank rows × 6 = 18 blank cells each expose a droppable-target placeholder.
    const blankTargets = container.querySelectorAll('[aria-hidden="true"]');
    expect(blankTargets.length).toBe(18);

    // Filled cells are labelled with 1-indexed grid coordinates.
    // The first filled row is board row 0 → view-model gridRow 1.
    expect(filledCells[0].getAttribute("aria-label")).toBe(
      "Piece 0 1 2, row 1, column 1",
    );
    expect(filledCells[5].getAttribute("aria-label")).toBe(
      "Piece 0 1 2, row 1, column 6",
    );
  });

  it("places cells on the correct 1-indexed grid lines per board size", () => {
    const state = buildBoardDisplayState(4);
    const telescope = Telescope.of(state);
    render(<BoardDisplay state={state} telescope={telescope} />);

    expect(screen.getByText("Board (4×4)")).toBeTruthy();
    // Even rows (board row 0 and 2) are filled → 2 × 4 = 8 labelled cells, and they
    // sit on the 1-indexed grid lines 1 and 3 with columns 1..4.
    const labels = screen
      .getAllByRole("img")
      .map((el) => el.getAttribute("aria-label"));
    expect(labels.length).toBe(8);
    expect(labels[0]).toBe("Piece 0 1 2, row 1, column 1");
    expect(labels[7]).toBe("Piece 0 1 2, row 3, column 4");
  });
});
