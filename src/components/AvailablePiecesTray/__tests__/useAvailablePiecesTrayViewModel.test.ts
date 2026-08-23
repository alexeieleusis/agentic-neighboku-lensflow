import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { firstValueFrom } from "rxjs";
import { Telescope } from "telescopejs";
import { createPiece, type Piece } from "../../../game/entities";
import type { Tray } from "../../../game/gameBuilder";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { useAvailablePiecesTrayViewModel } from "../useAvailablePiecesTrayViewModel";
import { TRAY_PIECE_IMAGE_PX } from "../useAvailablePiecesTrayDomain";
import type {
  AvailablePiecesTrayColumn,
  AvailablePiecesTrayState,
} from "../AvailablePiecesTray.types";

function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

/** Render `useAvailablePiecesTrayViewModel` against a standalone tray telescope. */
function renderViewModel(state: AvailablePiecesTrayState) {
  const props: TelescopedProps<AvailablePiecesTrayState> = {
    state,
    telescope: Telescope.of(state),
  };
  return renderHook(() => useAvailablePiecesTrayViewModel(props));
}

describe("useAvailablePiecesTrayViewModel", () => {
  it("derives one sorted column per remaining value", () => {
    const { result } = renderViewModel({
      size: 6,
      availablePieces: trayOf([
        [[1, 1, 1], 2],
        [[0, 2, 0], 1],
        [[0, 0, 0], 3],
        [[1, 0, 0], 0],
      ]),
    });

    // The zero-count value ([1,0,0]) gets no column; the rest sort ascending by
    // base-10 value: [0,0,0]→0, [0,2,0]→20, [1,1,1]→111.
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [0, 0, 0],
      [0, 2, 0],
      [1, 1, 1],
    ]);
    expect(result.current.columns.map((c) => c.count)).toEqual([3, 1, 2]);
  });

  it("hands each column its piece image as a live magnified-telescope slice", async () => {
    // Build the tray with a single shared piece reference (§8.7: map lookups are by
    // reference), so the column's piece is that exact instance.
    const piece = createPiece([1, 0, 0], 3, 3);
    const tray = new Map<Piece, number>([[piece, 1]]);
    const { result } = renderViewModel({
      size: 4,
      availablePieces: tray,
    });
    const column: AvailablePiecesTrayColumn = result.current.columns[0];

    expect(column.piece).toBe(piece);
    expect(column.count).toBe(1);
    expect(column.pieceImage.state).toEqual({
      piece,
      size: TRAY_PIECE_IMAGE_PX,
    });

    // The magnified telescope is a working slice: its stream emits the column's
    // piece-image state.
    await expect(
      firstValueFrom(column.pieceImage.telescope.stream),
    ).resolves.toEqual({ piece, size: TRAY_PIECE_IMAGE_PX });
  });

  it("tracks the tray state as the underlying game state changes", () => {
    const telescope = Telescope.of<AvailablePiecesTrayState>({
      size: 6,
      availablePieces: trayOf([
        [[0, 0, 0], 2],
        [[1, 1, 1], 1],
      ]),
    });

    const stateA: AvailablePiecesTrayState = {
      size: 6,
      availablePieces: trayOf([
        [[0, 0, 0], 2],
        [[1, 1, 1], 1],
      ]),
    };

    const { result, rerender } = renderHook(
      (state: AvailablePiecesTrayState) =>
        useAvailablePiecesTrayViewModel({ state, telescope }),
      { initialProps: stateA },
    );

    expect(result.current.columns.map((c) => c.count)).toEqual([2, 1]);

    // Place both copies of the smaller value: it must drop its column entirely…
    rerender({
      size: 6,
      availablePieces: trayOf([
        [[0, 0, 0], 0],
        [[1, 1, 1], 1],
      ]),
    });
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [1, 1, 1],
    ]);

    // …and undoing it must bring the column back in its sorted slot.
    rerender({
      size: 6,
      availablePieces: trayOf([
        [[0, 0, 0], 1],
        [[1, 1, 1], 1],
      ]),
    });
    expect(result.current.columns.map((c) => [...c.piece])).toEqual([
      [0, 0, 0],
      [1, 1, 1],
    ]);
    expect(result.current.columns.map((c) => c.count)).toEqual([1, 1]);
  });
});
