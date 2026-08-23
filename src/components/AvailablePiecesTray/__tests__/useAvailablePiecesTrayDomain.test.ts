import { describe, expect, it } from "vitest";
import { createPiece, type Piece } from "../../../game/entities";
import {
  TRAY_PIECE_IMAGE_PX,
  TRAY_WIDTH_PER_SIZE_PX,
  pieceBase10Value,
  sortedRemainingPieces,
  trayRemainingCount,
  trayWidthPx,
} from "../useAvailablePiecesTrayDomain";
import type { Tray } from "../../../game/gameBuilder";

function trayOf(
  entries: ReadonlyArray<readonly [readonly number[], number]>,
): Tray {
  const tray = new Map<Piece, number>();
  for (const [digits, count] of entries) {
    tray.set(createPiece(digits, 3, 3), count);
  }
  return tray;
}

describe("pieceBase10Value (§5.5 sort key)", () => {
  it("reads the attribute digits as decimal digits, most significant first", () => {
    expect(pieceBase10Value(createPiece([0, 0, 0], 3, 3))).toBe(0);
    expect(pieceBase10Value(createPiece([0, 2, 0], 3, 3))).toBe(20);
    expect(pieceBase10Value(createPiece([1, 0, 0], 3, 3))).toBe(100);
    expect(pieceBase10Value(createPiece([1, 1, 1], 3, 3))).toBe(111);
    expect(pieceBase10Value(createPiece([2, 1, 0], 3, 3))).toBe(210);
  });

  it("handles 2-dimensional pieces (their digit is simply shorter)", () => {
    expect(pieceBase10Value(createPiece([1, 2], 2, 3))).toBe(12);
  });
});

describe("sortedRemainingPieces (§5.5 first bullet)", () => {
  it("orders values ascending by base-10-encoded value regardless of map order", () => {
    const tray = trayOf([
      [[2, 1, 0], 1],
      [[0, 0, 0], 2],
      [[1, 1, 1], 1],
      [[0, 2, 0], 3],
      [[1, 0, 0], 4],
    ]);
    expect(sortedRemainingPieces(tray)).toEqual([
      createPiece([0, 0, 0], 3, 3),
      createPiece([0, 2, 0], 3, 3),
      createPiece([1, 0, 0], 3, 3),
      createPiece([1, 1, 1], 3, 3),
      createPiece([2, 1, 0], 3, 3),
    ]);
  });

  it("excludes values whose remaining count is zero", () => {
    const tray = trayOf([
      [[0, 0, 0], 0],
      [[1, 1, 1], 2],
    ]);
    expect(sortedRemainingPieces(tray)).toEqual([createPiece([1, 1, 1], 3, 3)]);
  });

  it("returns an empty array for an empty tray", () => {
    expect(sortedRemainingPieces(trayOf([]))).toEqual([]);
  });

  it("does not mutate the input tray", () => {
    const tray = trayOf([
      [[2, 0, 0], 1],
      [[0, 0, 0], 1],
    ]);
    const before = [...tray];
    sortedRemainingPieces(tray);
    expect([...tray]).toEqual(before);
  });
});

describe("trayRemainingCount (§5.5 second bullet)", () => {
  it("reads the remaining count for a present value", () => {
    // Tray maps are keyed by piece reference (§8.7), so the lookup reuses the exact
    // `Piece` instances the map was built with.
    const pieceA = createPiece([0, 2, 0], 3, 3);
    const pieceB = createPiece([1, 0, 0], 3, 3);
    const tray = new Map<Piece, number>([
      [pieceA, 3],
      [pieceB, 1],
    ]);
    expect(trayRemainingCount(tray, pieceA)).toBe(3);
    expect(trayRemainingCount(tray, pieceB)).toBe(1);
  });

  it("is 0 for a value that is fully placed (absent from the tray)", () => {
    const tray = trayOf([[[0, 2, 0], 1]]);
    expect(trayRemainingCount(tray, createPiece([2, 2, 2], 3, 3))).toBe(0);
  });
});

describe("trayWidthPx (§5.5 width rule)", () => {
  it("is 56px × size for each supported board size", () => {
    expect(TRAY_WIDTH_PER_SIZE_PX).toBe(56);
    expect(trayWidthPx(4)).toBe(224);
    expect(trayWidthPx(6)).toBe(336);
    expect(trayWidthPx(12)).toBe(672);
    expect(trayWidthPx(16)).toBe(896);
  });
});

describe("layout constants", () => {
  it("exposes the tray piece-image pixel edge used by the view model", () => {
    expect(TRAY_PIECE_IMAGE_PX).toBeGreaterThan(0);
  });
});
