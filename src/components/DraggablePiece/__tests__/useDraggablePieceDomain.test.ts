import { describe, expect, it } from "vitest";
import { createPiece } from "../../../game/entities";
import {
  dragPieceStyle,
  pieceFromDraggableId,
  trayPieceDraggableId,
} from "../useDraggablePieceDomain";

const piece = createPiece([1, 2, 0], 3, 3);

const pieceIdTests = [
  {
    name: "encodes the piece's digits as `piece-{digits}`",
    run: () => {
      expect(trayPieceDraggableId(piece)).toBe("piece-1-2-0");
      expect(trayPieceDraggableId(createPiece([0, 0, 0], 3, 3))).toBe(
        "piece-0-0-0",
      );
      expect(trayPieceDraggableId(createPiece([5], 1, 10))).toBe("piece-5");
    },
  },
  {
    name: "round-trips through the inverse parse",
    run: () => {
      expect(pieceFromDraggableId(trayPieceDraggableId(piece))).toEqual([
        1, 2, 0,
      ]);
      expect(pieceFromDraggableId("piece-5")).toEqual([5]);
    },
  },
];

const UNPARSEABLE_IDS = [
  "piece-", // no digits
  "piece-1-a", // non-numeric digit
  "piece--1", // negative
  "piece 1-2-0", // wrong separator
  "cell-0-0", // a cell droppable id, not a piece id
  "piece", // missing dash
  "piece-1-2-0x", // trailing junk
  "",
];

describe("DraggablePiece domain (§5.6 draggable ids + in-drag style)", () => {
  for (const tc of pieceIdTests) it(tc.name, tc.run);

  it("rejects ids that are not the `piece-{digits}` shape", () => {
    for (const id of UNPARSEABLE_IDS) {
      expect(pieceFromDraggableId(id)).toBeNull();
    }
  });

  it("at rest (no transform): no transform/zIndex, grab cursor, pointer locked", () => {
    expect(dragPieceStyle(null, false)).toEqual({
      touchAction: "none",
      cursor: "grab",
    });
  });

  it("while dragging: the dnd-kit transform, grabbing cursor, and a stacked z-index", () => {
    expect(
      dragPieceStyle({ x: 12, y: -4, scaleX: 1, scaleY: 1 }, true),
    ).toEqual({
      touchAction: "none",
      cursor: "grabbing",
      transform: "translate3d(12px, -4px, 0)",
      zIndex: 1,
    });
  });
});
