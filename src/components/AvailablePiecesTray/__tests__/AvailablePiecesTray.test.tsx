import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Telescope } from "telescopejs";
import { createPiece, type Piece } from "../../../game/entities";
import type { Tray } from "../../../game/gameBuilder";
import { AvailablePiecesTray } from "../AvailablePiecesTray";
import type { AvailablePiecesTrayState } from "../AvailablePiecesTray.types";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/6 tests).
afterEach(() => {
  cleanup();
});

function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

function renderTray(state: AvailablePiecesTrayState) {
  return render(
    <AvailablePiecesTray state={state} telescope={Telescope.of(state)} />,
  );
}

/** The column svgs' accessible names, in DOM (left-to-right) order. */
function columnTitles(container: ParentNode): readonly string[] {
  return Array.from(container.querySelectorAll("svg")).map(
    (svg) => svg.querySelector("title")?.textContent ?? "",
  );
}

/**
 * A size-6 mid-game tray whose map insertion order is deliberately the reverse of the
 * §5.5 ascending order, plus one fully-placed (zero-count) value that must not get a
 * column. Expected order: [0,0,0] (0), [0,2,0] (20), [1,0,0] (100), [1,1,1] (111).
 */
const MID_GAME_STATE = {
  size: 6,
  availablePieces: trayOf([
    [[1, 1, 1], 4],
    [[1, 0, 0], 2],
    [[0, 2, 0], 1],
    [[0, 0, 0], 3],
    [[2, 0, 0], 0],
  ]),
} satisfies AvailablePiecesTrayState;

const EXPECTED_TITLES = [
  "circle, red border, aquamarine fill", // [0,0,0]
  "circle, mediumseagreen border, aquamarine fill", // [0,2,0]
  "triangle, red border, aquamarine fill", // [1,0,0]
  "triangle, dodgerblue border, yellow fill", // [1,1,1]
];

describe("AvailablePiecesTray (§5.5)", () => {
  it("renders exactly one column per distinct remaining piece value, sorted ascending", () => {
    const { container } = renderTray(MID_GAME_STATE);

    // 5 values in the tray, but the zero-count one ([2,0,0]) gets no column.
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(4);

    // Left-to-right DOM order follows base-10-encoded value, not map order.
    expect(columnTitles(container)).toEqual(EXPECTED_TITLES);
  });

  it("shows each column's remaining count, matching the tray state", () => {
    renderTray(MID_GAME_STATE);
    expect(screen.getByText("3")).toBeTruthy(); // [0,0,0]
    expect(screen.getByText("1")).toBeTruthy(); // [0,2,0]
    expect(screen.getByText("2")).toBeTruthy(); // [1,0,0]
    expect(screen.getByText("4")).toBeTruthy(); // [1,1,1]
    // The fully-placed value's count is 0 and renders no column at all.
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders the piece image via the shared Phase 6 PieceDisplay (one svg per column)", () => {
    const { container } = renderTray(MID_GAME_STATE);
    // 2 circles + 1 triangle + 1 triangle; the missing zero-count square renders no rect.
    expect(container.querySelectorAll("circle").length).toBe(2);
    expect(container.querySelectorAll("polygon").length).toBe(2);
    expect(container.querySelectorAll("rect").length).toBe(0);
  });

  it("spans the width of the board (columns wrap only when the next column would not fit)", () => {
    const { container } = renderTray(MID_GAME_STATE);
    // The column row is 100% wide — the same width the board above it fills — so a
    // column drops to the next row only when it would not fit here (the row keeps
    // `flexWrap: "wrap"`, asserted visually in the stories).
    const rowEl = Array.from(
      container.querySelectorAll<HTMLElement>("[style]"),
    ).find((el) => el.style.width === "100%");
    expect(rowEl).toBeTruthy();
  });

  it("renders no `*` hint and no click-to-place buttons (Phase 13 scope)", () => {
    const { container } = renderTray(MID_GAME_STATE);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.textContent ?? "").not.toContain("*");
  });

  it("renders the heading and no columns for an emptied tray", () => {
    const { container } = renderTray({
      size: 4,
      availablePieces: trayOf([]),
    });
    expect(screen.getByText("Piece tray")).toBeTruthy();
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});
