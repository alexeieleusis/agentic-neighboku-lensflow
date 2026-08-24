import { describe, expect, it } from "vitest";
import { cellDroppableId, cellFromDroppableId } from "../useCellDisplayDomain";

const cellIdTests = [
  {
    name: "encodes (row, col) as `cell-{row}-{col}` (0-indexed board addressing)",
    run: () => {
      expect(cellDroppableId(0, 0)).toBe("cell-0-0");
      expect(cellDroppableId(1, 2)).toBe("cell-1-2");
      expect(cellDroppableId(15, 0)).toBe("cell-15-0");
    },
  },
  {
    name: "round-trips through the inverse parse",
    run: () => {
      for (const row of [0, 1, 5]) {
        for (const col of [0, 3, 8]) {
          expect(cellFromDroppableId(cellDroppableId(row, col))).toEqual([
            row,
            col,
          ]);
        }
      }
    },
  },
];

const UNPARSEABLE_IDS = [
  "cell-1", // missing column
  "cell-1-2-3", // trailing garbage
  "cell-a-b", // non-numeric
  "cell--1-2", // negative
  "cell-1-2x", // trailing junk
  "cell", // no coordinates at all
  "piece-0-0", // a tray-piece id, not a cell id
  "",
];

describe("CellDisplay domain (§5.6 droppable ids)", () => {
  for (const tc of cellIdTests) it(tc.name, tc.run);

  it("rejects ids that are not the `cell-{row}-{col}` shape", () => {
    for (const id of UNPARSEABLE_IDS) {
      expect(cellFromDroppableId(id)).toBeNull();
    }
  });
});
