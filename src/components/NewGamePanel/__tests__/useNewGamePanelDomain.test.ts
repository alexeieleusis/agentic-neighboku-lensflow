import { describe, expect, it } from "vitest";
import {
  BOARD_SIZES,
  DEFAULT_BOARD_SIZE,
  DEFAULT_DIMENSION,
  FORCED_DIMENSION,
  FORCED_DIMENSION_MIN_SIZE,
  initialDimension,
  selectBoardSize,
} from "../useNewGamePanelDomain";

/**
 * §4.1/§5.9 pure-tier tests (requirements §7.5: domain functions are the
 * highest-priority tier — no React, no telescope, no rendering).
 */

describe("useNewGamePanelDomain (§4.1 size spec)", () => {
  it("specs exactly the six §4.1 board sizes, in select order — no more and no fewer", () => {
    expect(BOARD_SIZES).toEqual([4, 6, 8, 9, 12, 16]);
    expect(BOARD_SIZES).toHaveLength(6);
  });

  it("specs §5.9's first-open default of 8×8", () => {
    expect(DEFAULT_BOARD_SIZE).toBe(8);
    // The default is one of the six selectable sizes.
    expect(BOARD_SIZES).toContain(DEFAULT_BOARD_SIZE);
  });

  it("specs §4.1's threshold and forced values", () => {
    expect(FORCED_DIMENSION_MIN_SIZE).toBe(8);
    expect(FORCED_DIMENSION).toBe(3);
  });
});

describe("useNewGamePanelDomain (§4.1 initial dimension)", () => {
  it("keeps a prior value when one exists", () => {
    for (const prior of [2, 3, 5]) {
      expect(initialDimension(prior)).toBe(prior);
    }
  });

  it("defaults to §4.1's 2 when no prior value exists", () => {
    expect(initialDimension(undefined)).toBe(2);
    expect(DEFAULT_DIMENSION).toBe(2);
  });
});

describe("useNewGamePanelDomain (§4.1 size→dimension rule)", () => {
  it("forces the dimension to 3 for every size >= 8", () => {
    // Every selectable size at and above the threshold forces 3,
    // regardless of the held dimension.
    for (const size of BOARD_SIZES) {
      if (size < FORCED_DIMENSION_MIN_SIZE) continue;
      expect(selectBoardSize(2, size)).toEqual({ size, dimension: 3 });
      expect(selectBoardSize(3, size)).toEqual({ size, dimension: 3 });
      expect(selectBoardSize(5, size)).toEqual({ size, dimension: 3 });
    }
  });

  it("leaves the dimension unchanged for every size < 8", () => {
    // §4.1's asymmetric half: 4×4 and 6×6 keep whatever dimension is held.
    for (const size of BOARD_SIZES) {
      if (size >= FORCED_DIMENSION_MIN_SIZE) continue;
      expect(selectBoardSize(2, size)).toEqual({ size, dimension: 2 });
      expect(selectBoardSize(3, size)).toEqual({ size, dimension: 3 });
    }
  });

  it("is asymmetric by design: 4×4 then 8×8 then 6×6 — the dimension only ever moves up-to-3, and a small size never pulls it back down", () => {
    // Start from the §4.1 no-prior-value default.
    let selection = {
      size: DEFAULT_BOARD_SIZE,
      dimension: initialDimension(undefined),
    };
    expect(selection).toEqual({ size: 8, dimension: 2 });

    // Select 4×4: the dimension is left unchanged (still the default 2).
    selection = selectBoardSize(selection.dimension, 4);
    expect(selection).toEqual({ size: 4, dimension: 2 });

    // Select 8×8: the dimension is forced to 3.
    selection = selectBoardSize(selection.dimension, 8);
    expect(selection).toEqual({ size: 8, dimension: 3 });

    // Select 6×6: the dimension is left unchanged — still 3, NOT pulled
    // back to the earlier 2. This is the asymmetry requirements §4.1 says
    // to "carry this exact rule forward even though it looks asymmetric".
    selection = selectBoardSize(selection.dimension, 6);
    expect(selection).toEqual({ size: 6, dimension: 3 });
  });

  it("never carries a `base` in the selection: the size selector cannot change it", () => {
    const selection = selectBoardSize(3, 9);
    expect("base" in selection).toBe(false);
  });
});
