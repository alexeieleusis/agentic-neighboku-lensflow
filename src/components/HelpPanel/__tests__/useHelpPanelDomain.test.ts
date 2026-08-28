import { describe, expect, it } from "vitest";
import { buildPiecePool } from "../../../game/boardBuilder";
import { isValidNeighbor } from "../../../game/common";
import type { Piece } from "../../../game/entities";
import {
  candidateSpaceFor,
  ENGLISH_TUTORIAL_VIDEO_LABEL,
  ENGLISH_TUTORIAL_VIDEO_URL,
  FREPIK_ATTRIBUTION_LABEL,
  FREPIK_ATTRIBUTION_URL,
  invalidNeighborSetFor,
  pieceLabel,
  resolvePieceByLabel,
  SPANISH_TUTORIAL_VIDEO_LABEL,
  SPANISH_TUTORIAL_VIDEO_URL,
  validNeighborSetFor,
} from "../useHelpPanelDomain";

/** The shipped configuration's candidate space: base 3, dimension 3. */
const SPACE = candidateSpaceFor(3, 3);

/** Value-keyed form of a piece set (the pools are interned per call, so set comparisons are by value, never by reference). */
function valueSet(pieces: readonly Piece[]): readonly string[] {
  return pieces.map((piece) => piece.join(",")).sort();
}

/** The hand-computed valid-neighbor set of `[0,0,0]` at base 3, dimension 3: the pieces sharing exactly one attribute position with it. */
const ZERO_ZERO_ZERO_VALID = [
  "0,1,1",
  "0,1,2",
  "0,2,1",
  "0,2,2",
  "1,0,1",
  "1,0,2",
  "2,0,1",
  "2,0,2",
  "1,1,0",
  "1,2,0",
  "2,1,0",
  "2,2,0",
];

describe("candidateSpaceFor (§5.10 item 1: the full candidate space)", () => {
  it("is the full base^dimension pool: 27 pieces at base 3, dimension 3, all distinct", () => {
    expect(SPACE).toHaveLength(27);
    expect(new Set(valueSet(SPACE)).size).toBe(27);
    for (const piece of SPACE) {
      expect(piece).toHaveLength(3);
    }
  });

  it("is 9 pieces at base 3, dimension 2, and tracks buildPiecePool's pool order", () => {
    const twoDimension = candidateSpaceFor(2, 3);
    expect(twoDimension).toHaveLength(9);
    expect(twoDimension.map((piece) => piece.join(","))).toEqual([
      "0,0",
      "0,1",
      "0,2",
      "1,0",
      "1,1",
      "1,2",
      "2,0",
      "2,1",
      "2,2",
    ]);
    // The panel's candidate space is Phase 2's pool itself — same values, same order.
    expect(valueSet(SPACE)).toEqual(valueSet(buildPiecePool(3, 3)));
  });
});

describe("validNeighborSetFor (§5.10 item 2: buildPossibleNeighbors, no exclusions)", () => {
  it("is exactly the §3.2 rule — every pool piece sharing exactly one attribute position with the selected piece — for a whole-space sweep", () => {
    for (const piece of SPACE) {
      const valid = validNeighborSetFor(piece, 3);
      // Cross-check against the Phase 1 rule itself: membership in the set
      // must agree with isValidNeighbor for every other pool piece.
      for (const other of SPACE) {
        const expected = other !== piece && isValidNeighbor(piece, other);
        const actual = valid.some(
          (member) => member.join(",") === other.join(","),
        );
        expect(actual, `${piece} / ${other}`).toBe(expected);
      }
    }
  });

  it("matches the hand-computed set for [0,0,0]", () => {
    const piece = SPACE[0];
    expect(piece.join(",")).toBe("0,0,0");
    expect(valueSet(validNeighborSetFor(piece, 3))).toEqual(
      [...ZERO_ZERO_ZERO_VALID].sort(),
    );
  });

  it("never contains the selected piece itself (a piece is not its own valid neighbor)", () => {
    for (const piece of [SPACE[0], SPACE[8], SPACE[26]]) {
      const valid = validNeighborSetFor(piece, 3);
      expect(valid.some((member) => member.join(",") === piece.join(","))).toBe(
        false,
      );
    }
  });

  it("is 4 pieces for a 2-attribute piece at base 3: [0,0] → the four single-position matches", () => {
    const space = candidateSpaceFor(2, 3);
    const piece = space[0];
    expect(valueSet(validNeighborSetFor(piece, 3))).toEqual([
      "0,1",
      "0,2",
      "1,0",
      "2,0",
    ]);
  });
});

describe("invalidNeighborSetFor (§5.10 item 3: candidate space minus the valid set)", () => {
  it("with the valid set, partitions the whole candidate space: no overlap, no omissions, for several selected pieces", () => {
    for (const piece of [SPACE[0], SPACE[8], SPACE[13], SPACE[26]]) {
      const valid = validNeighborSetFor(piece, 3);
      const invalid = invalidNeighborSetFor(SPACE, valid);

      // Together they cover exactly the candidate space…
      expect(invalid.length + valid.length).toBe(SPACE.length);
      // …disjoint by value…
      for (const member of invalid) {
        expect(
          valid.some((v) => v.join(",") === member.join(",")),
          `${member} appears in both sets`,
        ).toBe(false);
      }
      // …and every space member lands in exactly one of them.
      for (const candidate of SPACE) {
        const inValid = valid.some((v) => v.join(",") === candidate.join(","));
        const inInvalid = invalid.some(
          (v) => v.join(",") === candidate.join(","),
        );
        expect(inValid !== inInvalid, `${candidate} misplaced`).toBe(true);
      }
    }
  });

  it("contains the selected piece itself (it is not its own valid neighbor)", () => {
    const piece = SPACE[8]; // [1,0,0]
    const invalid = invalidNeighborSetFor(SPACE, validNeighborSetFor(piece, 3));
    expect(invalid.some((member) => member.join(",") === piece.join(","))).toBe(
      true,
    );
  });

  it("is the whole space when the valid set is empty (the degenerate 1-attribute base-2 space)", () => {
    const space = candidateSpaceFor(1, 2); // [0], [1] — they share zero attributes
    const piece = space[0];
    expect(validNeighborSetFor(piece, 2)).toHaveLength(0);
    expect(valueSet(invalidNeighborSetFor(space, []))).toEqual(valueSet(space));
  });
});

describe("pieceLabel / resolvePieceByLabel (the selector's value plumbing)", () => {
  it("labels a piece as its space-separated digits", () => {
    expect(pieceLabel(SPACE[0])).toBe("0 0 0");
    expect(pieceLabel([0, 2, 1])).toBe("0 2 1");
  });

  it("labels are unique within a candidate space, so every option value identifies exactly one piece", () => {
    const labels = SPACE.map(pieceLabel);
    expect(new Set(labels).size).toBe(SPACE.length);
  });

  it("round-trips every member of the space: label → the very same piece value", () => {
    for (const piece of SPACE) {
      const resolved = resolvePieceByLabel(SPACE, pieceLabel(piece));
      expect(resolved?.join(",")).toBe(piece.join(","));
    }
  });

  it("resolves the no-selection value (empty label) and unknown labels to null, never to a piece", () => {
    for (const label of ["", "Select a piece", "9 9 9", "0 0", "0,0,0", "00"]) {
      expect(resolvePieceByLabel(SPACE, label)).toBeNull();
    }
  });

  it("does not leak across spaces: a dimension-2 label does not resolve in the dimension-3 space", () => {
    expect(resolvePieceByLabel(SPACE, "0 0")).toBeNull();
  });
});

describe("the static link data (§5.10 items 4–6)", () => {
  it("carries the two tutorial-video links as real, distinct, non-placeholder hrefs with their §5.10 labels", () => {
    expect(ENGLISH_TUTORIAL_VIDEO_URL).toMatch(/^https:\/\/youtu\.be\/\w+$/);
    expect(SPANISH_TUTORIAL_VIDEO_URL).toMatch(/^https:\/\/youtu\.be\/\w+$/);
    expect(ENGLISH_TUTORIAL_VIDEO_URL).not.toBe(SPANISH_TUTORIAL_VIDEO_URL);
    expect(ENGLISH_TUTORIAL_VIDEO_LABEL).toBe("Tutorial in English");
    expect(SPANISH_TUTORIAL_VIDEO_LABEL).toBe("Tutorial en Español");
  });

  it("carries the §5.4 Freepik credit at its exact URL and label", () => {
    expect(FREPIK_ATTRIBUTION_URL).toBe(
      "https://www.freepik.com/free-vector/young-people-expressions-with-different-faces_1250793.htm",
    );
    expect(FREPIK_ATTRIBUTION_LABEL).toBe("Images under license by Freep!k");
  });
});
