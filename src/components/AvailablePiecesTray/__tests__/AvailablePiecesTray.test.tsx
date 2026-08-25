import { useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { createPiece, type Piece } from "../../../game/entities";
import type { Board } from "../../../game/boardBuilder";
import type {
  Game,
  Move,
  PieceFitCache,
  Tray,
} from "../../../game/gameBuilder";
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

/**
 * A stand-in `Game` for the render-only tests: the tray's render path reads
 * `availablePieces` + `pieceToFitCells` and never indexes the board, so an empty
 * stand-in board suffices here. The click-commit test below uses a real (if small,
 * fully hand-built) 2×2 board instead, because `placePiece` — which the commit goes
 * through — does index it and recompute both fit caches on it.
 */
const EMPTY_BOARD: Board = [];
const NO_MOVES: readonly Move[] = [];

function gameOf(
  size: number,
  tray: Tray,
  pieceToFitCells: PieceFitCache = new Map<Piece, number[]>(),
  board: Board = EMPTY_BOARD,
): Game {
  return {
    size,
    board,
    availablePieces: tray,
    placedCells: NO_MOVES,
    pieceToFitCells,
    cellToFitPieces: new Map<number, Piece[]>(),
    preferences: { preventInvalidMoves: true },
  };
}

function trayState(
  game: Game,
  availablePieceUniqueCell = false,
  pieceCells = false,
): AvailablePiecesTrayState {
  return { game, availablePieceUniqueCell, pieceCells };
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

/** The real `<button>` elements (the MUI click-to-place buttons; dnd-kit's
 * draggable node is a `div[role="button"]` and does not match). */
function clickPlaceButtons(container: ParentNode): readonly HTMLElement[] {
  return Array.from(container.querySelectorAll("button"));
}

/**
 * A size-6 mid-game tray whose map insertion order is deliberately the reverse of the
 * §5.5 ascending order, plus one fully-placed (zero-count) value that must not get a
 * column. Expected order: [0,0,0] (0), [0,2,0] (20), [1,0,0] (100), [1,1,1] (111).
 * Both hints are off, so no column may show a `*` or a button.
 */
const MID_GAME_STATE: AvailablePiecesTrayState = trayState(
  gameOf(
    6,
    trayOf([
      [[1, 1, 1], 4],
      [[1, 0, 0], 2],
      [[0, 2, 0], 1],
      [[0, 0, 0], 3],
      [[2, 0, 0], 0],
    ]),
  ),
);

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

  it("tray row has width 100% (columns wrap via flexWrap; overflow behavior covered by stories)", () => {
    const { container } = renderTray(MID_GAME_STATE);
    // The column row is 100% wide — the same width the board above it fills — so a
    // column drops to the next row only when it would not fit here (the row keeps
    // `flexWrap: "wrap"`, asserted visually in the stories).
    const rowEl = Array.from(
      container.querySelectorAll<HTMLElement>("[style]"),
    ).find((el) => el.style.width === "100%");
    expect(rowEl).toBeTruthy();
  });

  it("renders no `*` hint and no click-to-place buttons when both hints are off", () => {
    const { container } = renderTray(MID_GAME_STATE);
    expect(clickPlaceButtons(container)).toHaveLength(0);
    expect(container.textContent ?? "").not.toContain("*");
  });

  it("renders the heading and no columns for an emptied tray", () => {
    const { container } = renderTray(trayState(gameOf(4, trayOf([]))));
    expect(screen.getByText("Piece tray")).toBeTruthy();
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* §5.5 second bullet — the unique-cell `*` hint                               */
/* -------------------------------------------------------------------------- */

/**
 * §5.5 second-bullet fixture: [0,0,0] ×2 remaining with exactly two legal fit-cells
 * (placement forced) and [0,2,0] ×1 remaining with two fit-cells (not forced).
 */
function forcedFixture(
  availablePieceUniqueCell: boolean,
  aFits: readonly number[] = [0, 1],
): AvailablePiecesTrayState {
  const pieceA = createPiece([0, 0, 0], 3, 3);
  const pieceB = createPiece([0, 2, 0], 3, 3);
  return trayState(
    gameOf(
      6,
      new Map<Piece, number>([
        [pieceA, 2],
        [pieceB, 1],
      ]),
      new Map<Piece, number[]>([
        [pieceA, [...aFits]],
        [pieceB, [3, 4]],
      ]),
    ),
    availablePieceUniqueCell,
  );
}

describe("AvailablePiecesTray §5.5 second bullet — the `*` hint", () => {
  it("appends a literal `*` to the count when the hint is on and the fit-cell count equals the remaining count", () => {
    const { container } = renderTray(forcedFixture(true));

    // Exactly one forced value: its column reads "2*", the other reads a bare "1".
    expect(screen.getByText("2*")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    const asterisks = (container.textContent ?? "").match(/\*/g);
    expect(asterisks).toHaveLength(1);
  });

  it("renders no `*` at all when the hint is off, even where the condition holds", () => {
    const { container } = renderTray(forcedFixture(false));
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(container.textContent ?? "").not.toContain("*");
  });

  it("renders no `*` when the fit-cell count differs from the remaining count", () => {
    // [0,0,0] now has only ONE legal fit-cell against its 2 remaining copies: the
    // "forced" condition (fits === count) no longer holds.
    const { container } = renderTray(forcedFixture(true, [0]));
    expect(screen.getByText("2")).toBeTruthy();
    expect(container.textContent ?? "").not.toContain("*");
  });
});

/* -------------------------------------------------------------------------- */
/* §5.5 third bullet — the click-to-place cell list                             */
/* -------------------------------------------------------------------------- */

/**
 * §5.5 third-bullet fixture, size 6: [0,0,0] ×2 with fit-cells at linear indices
 * 0, 6, 7 → cells (0,0), (1,0), (1,1) → labels "1,1", "2,1", "2,2"; [0,2,0] ×1 with
 * fit-cell 30 → cell (5,0) → label "6,1". The `availablePieceUniqueCell` flag here is
 * off, so no `*` distracts the button assertions.
 */
function buttonFixture(pieceCells: boolean): AvailablePiecesTrayState {
  const pieceA = createPiece([0, 0, 0], 3, 3);
  const pieceB = createPiece([0, 2, 0], 3, 3);
  return trayState(
    gameOf(
      6,
      new Map<Piece, number>([
        [pieceA, 2],
        [pieceB, 1],
      ]),
      new Map<Piece, number[]>([
        [pieceA, [0, 6, 7]],
        [pieceB, [30]],
      ]),
    ),
    false,
    pieceCells,
  );
}

describe("AvailablePiecesTray §5.5 third bullet — the click-to-place buttons", () => {
  it("lists exactly one button per legal fit-cell, labeled with the 1-indexed row,column, when the hint is on", () => {
    const { container } = renderTray(buttonFixture(true));
    expect(clickPlaceButtons(container).map((b) => b.textContent)).toEqual([
      "1,1",
      "2,1",
      "2,2",
      "6,1",
    ]);
  });

  it("renders no click-to-place buttons when the hint is off, regardless of the fit cache", () => {
    const { container } = renderTray(buttonFixture(false));
    expect(clickPlaceButtons(container)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The click-to-place commit: the shared placePiece path                        */
/* -------------------------------------------------------------------------- */

/**
 * A `main.tsx`-style root subscription, factored into a harness so a commit written
 * through the tray telescope re-renders the tray exactly as in production (where the
 * shell's root re-renders on every emission).
 */
function TrayHarness(
  props: TelescopedProps<AvailablePiecesTrayState>,
): React.ReactElement {
  const [current, setCurrent] = useState(props.state);
  useEffect(() => {
    const subscription = props.telescope.stream.subscribe(setCurrent);
    return () => subscription.unsubscribe();
  }, [props.telescope]);
  return <AvailablePiecesTray state={current} telescope={props.telescope} />;
}

describe("AvailablePiecesTray §5.5 third bullet — the click-to-place commit", () => {
  it("clicking a button places the piece through placePiece: board filled, tray decremented, fit caches recomputed, columns rebuilt", () => {
    // A real 2×2 board (the engine's `placePiece` indexes it and recomputes both
    // caches on it): cells (0,0), (0,1) and (1,0) hold distinct values and the
    // tray holds exactly ONE piece — [1,0,0] ×1 — whose only legal fit-cell is the
    // blank (1,1) (linear index 3): one column, one button, labeled "2,2".
    const piece = createPiece([1, 0, 0], 3, 3);
    const a: Piece = createPiece([0, 0, 0], 3, 3);
    const b: Piece = createPiece([0, 0, 1], 3, 3);
    const c: Piece = createPiece([0, 1, 0], 3, 3);
    const board: Board = [
      [a, b],
      [c, null],
    ];
    const game = gameOf(
      2,
      new Map<Piece, number>([[piece, 1]]),
      new Map<Piece, number[]>([[piece, [3]]]),
      board,
    );
    const state = trayState(game, true, true);
    const telescope = Telescope.of(state);
    const emissions: AvailablePiecesTrayState[] = [];

    const { container } = render(
      <TrayHarness state={state} telescope={telescope} />,
    );
    const subscription = telescope.stream.subscribe((s) => emissions.push(s));

    // The single column: its one legal fit-cell makes the placement forced, so the
    // hint (on) reads "1*", and the button list (on) carries exactly "2,2".
    expect(screen.getByText("1*")).toBeTruthy();
    const button = screen.getByRole("button", { name: "2,2" });

    fireEvent.click(button);

    // Replayed initial state + exactly one committed update — the tray's write
    // flowing through its telescope, exactly as it does through the shell's tray
    // lens in production.
    expect(emissions).toHaveLength(2);
    const next = emissions[1];
    expect(next).not.toBe(state);
    // The board cell now holds exactly the interned piece the button carried.
    expect(next.game.board[1][1]).toBe(piece);
    // The tray dropped the value at zero (§3.5 step 3); the move is recorded.
    expect(next.game.availablePieces.get(piece)).toBeUndefined();
    expect(next.game.placedCells.at(-1)).toEqual({
      pieceValue: piece,
      cell: [1, 1],
      isValid: true,
    });
    // The just-filled cell is no longer ANY piece's fit cell in the recomputed
    // caches (§3.5 step 5).
    for (const cells of next.game.pieceToFitCells.values()) {
      expect(cells).not.toContain(3);
    }
    // The DOM rebuilt from the committed state: the emptied piece's whole column —
    // its image, its (now-absent) count, and the "2,2" button — is gone.
    expect(screen.queryByText("1*")).toBeNull();
    expect(screen.queryByRole("button", { name: "2,2" })).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    subscription.unsubscribe();
  });
});
