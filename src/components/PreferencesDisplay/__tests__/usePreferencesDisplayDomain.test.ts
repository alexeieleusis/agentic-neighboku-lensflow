import { describe, expect, it } from "vitest";
import type { AppPreferences } from "../../../App.types";
import type { BooleanPreferenceKey } from "../PreferencesDisplay.types";
import {
  BOOLEAN_PREFERENCE_ROWS,
  PIECE_TYPE_OPTIONS,
  PIECE_TYPE_ROW_LABEL,
  getBooleanPreference,
  setBooleanPreference,
  setPieceType,
} from "../usePreferencesDisplayDomain";

/**
 * §5.8 pure-tier tests (requirements §7.5: domain functions are the
 * highest-priority tier — no React, no telescope, no rendering).
 */

/** All 8 boolean fields on, every other §4.2 field at its default. */
const ALL_ON = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Shapes",
  hints: {
    fitPieceCount: true,
    pieceCells: true,
    fitOnDrag: true,
    showFitPiecesOnHover: true,
    availablePiecesCount: true,
    availablePieceUniqueCell: true,
    gameIsSolvable: true,
  },
  preventInvalidMoves: true,
  sound: true,
} satisfies AppPreferences;

/** All 8 boolean fields off. */
const ALL_OFF = {
  scalars: { base: 3, dimension: 3, size: 6 },
  pieceType: "Shapes",
  hints: {
    fitPieceCount: false,
    pieceCells: false,
    fitOnDrag: false,
    showFitPiecesOnHover: false,
    availablePiecesCount: false,
    availablePieceUniqueCell: false,
    gameIsSolvable: false,
  },
  preventInvalidMoves: false,
  sound: false,
} satisfies AppPreferences;

/**
 * Independently-built fixtures: for each §5.8 key, `ALL_ON` with exactly that
 * key's field flipped off (and no other field touched) — written by hand so
 * the getter table is verified against fixtures that do not share the setter
 * table's implementation.
 */
const SINGLE_OFF: Record<BooleanPreferenceKey, AppPreferences> = {
  hintFitPieceCount: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, fitPieceCount: false },
  },
  hintAvailablePieceUniqueCell: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, availablePieceUniqueCell: false },
  },
  hintPieceCells: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, pieceCells: false },
  },
  hintFitOnDrag: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, fitOnDrag: false },
  },
  showFitPiecesOnHover: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, showFitPiecesOnHover: false },
  },
  preventInvalidMoves: { ...ALL_ON, preventInvalidMoves: false },
  hintGameIsSolvable: {
    ...ALL_ON,
    hints: { ...ALL_ON.hints, gameIsSolvable: false },
  },
  sound: { ...ALL_ON, sound: false },
};

describe("usePreferencesDisplayDomain (§5.8 row spec)", () => {
  it("specs the 8 boolean rows in §5.8's exact table order, with the table's exact labels", () => {
    expect(BOOLEAN_PREFERENCE_ROWS.map((row) => row.key)).toEqual([
      "hintFitPieceCount",
      "hintAvailablePieceUniqueCell",
      "hintPieceCells",
      "hintFitOnDrag",
      "showFitPiecesOnHover",
      "preventInvalidMoves",
      "hintGameIsSolvable",
      "sound",
    ]);
    expect(BOOLEAN_PREFERENCE_ROWS.map((row) => row.label)).toEqual([
      "Hint Fit Piece Count",
      "Hint Fit Piece Unique Cell",
      "Hint Piece Cells",
      "Hint Fit On Drag",
      "Show Fit Pieces on Hover",
      "Prevent Invalid Moves",
      "Hint Game Is Solvable",
      "Sound",
    ]);
  });

  it("specs the pieceType row's exact §5.8 label and its two options", () => {
    expect(PIECE_TYPE_ROW_LABEL).toBe("Piece Type: Shapes or Faces");
    expect(PIECE_TYPE_OPTIONS).toEqual(["Shapes", "Faces"]);
  });
});

describe("usePreferencesDisplayDomain (§5.8 boolean preference read/write)", () => {
  it("reads each §5.8 key from the correct §4.2 field (nested hints and top-level alike)", () => {
    for (const key of BOOLEAN_PREFERENCE_ROWS.map((row) => row.key)) {
      expect(getBooleanPreference(ALL_ON, key)).toBe(true);
      expect(getBooleanPreference(ALL_OFF, key)).toBe(false);
      // Exactly one field off: this key reads it, every other key does not.
      expect(getBooleanPreference(SINGLE_OFF[key], key)).toBe(false);
      for (const other of BOOLEAN_PREFERENCE_ROWS.map((r) => r.key)) {
        if (other !== key)
          expect(getBooleanPreference(SINGLE_OFF[key], other)).toBe(true);
      }
    }
  });

  it("writes each §5.8 key to the correct §4.2 field, leaving every other field untouched", () => {
    for (const key of BOOLEAN_PREFERENCE_ROWS.map((row) => row.key)) {
      // A fresh object, structurally identical to the all-on fixture with this
      // one field off — and nothing else moved.
      const next = setBooleanPreference(SINGLE_OFF[key], key, true);
      expect(next).toEqual(ALL_ON);
      const back = setBooleanPreference(ALL_ON, key, false);
      expect(back).toEqual(SINGLE_OFF[key]);
    }
  });

  it("does not mutate its input", () => {
    const input = ALL_ON;
    const snapshot = JSON.stringify(input);
    setBooleanPreference(input, "hintFitPieceCount", false);
    setBooleanPreference(input, "sound", false);
    setPieceType(input, "Faces");
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns the input reference when the value is already what the row holds (no re-emission through the telescope)", () => {
    for (const key of BOOLEAN_PREFERENCE_ROWS.map((row) => row.key)) {
      expect(setBooleanPreference(ALL_ON, key, true)).toBe(ALL_ON);
      expect(setBooleanPreference(ALL_OFF, key, false)).toBe(ALL_OFF);
    }
  });

  it("keeps the 8 rows mutually independent: one write moves exactly one field", () => {
    // A top-level row (`sound`): only that field moves — the untouched nested
    // `hints` object keeps its own reference (minimal write).
    const top = setBooleanPreference(ALL_ON, "sound", false);
    expect(top).toEqual(SINGLE_OFF.sound);
    expect(top.hints).toBe(ALL_ON.hints);
    expect(top.scalars).toBe(ALL_ON.scalars);
    expect(top.pieceType).toBe("Shapes");

    // A nested hint row: `hints` is rebuilt fresh with every sibling intact,
    // and the top-level fields keep their references.
    const nested = setBooleanPreference(ALL_ON, "hintFitPieceCount", false);
    expect(nested).toEqual(SINGLE_OFF.hintFitPieceCount);
    expect(nested.hints).not.toBe(ALL_ON.hints);
    expect(nested.hints.pieceCells).toBe(true);
    expect(nested.hints.gameIsSolvable).toBe(true);
    expect(nested.scalars).toBe(ALL_ON.scalars);
    expect(nested.sound).toBe(true);
  });
});

describe("usePreferencesDisplayDomain (§5.8 pieceType write)", () => {
  it("selects 'Faces', leaving every other field on the same reference", () => {
    const next = setPieceType(ALL_ON, "Faces");
    expect(next.pieceType).toBe("Faces");
    expect(next.scalars).toBe(ALL_ON.scalars);
    expect(next.hints).toBe(ALL_ON.hints);
    expect(next.preventInvalidMoves).toBe(ALL_ON.preventInvalidMoves);
    expect(next.sound).toBe(ALL_ON.sound);
  });

  it("re-selects 'Shapes' symmetrically", () => {
    const faces = { ...ALL_ON, pieceType: "Faces" } satisfies AppPreferences;
    const next = setPieceType(faces, "Shapes");
    expect(next).toEqual(ALL_ON);
    // A fresh object (not the fixture's reference), with every other field
    // on the input's own references.
    expect(next).not.toBe(faces);
    expect(next.hints).toBe(ALL_ON.hints);
    expect(next.scalars).toBe(ALL_ON.scalars);
  });

  it("returns the input reference when the held value is re-selected", () => {
    expect(setPieceType(ALL_ON, "Shapes")).toBe(ALL_ON);
  });
});
