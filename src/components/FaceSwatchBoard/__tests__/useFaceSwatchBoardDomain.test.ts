import { describe, expect, it } from "vitest";
import type { FaceSwatchBoardState } from "../FaceSwatchBoard.types";
import {
  canDropTile,
  dropTile,
  faceTileImageSrc,
  returnSlotTile,
} from "../useFaceSwatchBoardDomain";

describe("FaceSwatchBoard domain", () => {
  const emptySlotState: FaceSwatchBoardState = {
    trayTileIds: ["h0e0m0", "h1e1m1"],
    slotTileId: null,
  };

  describe("canDropTile", () => {
    it("allows dropping a tray tile into an empty slot", () => {
      expect(canDropTile(emptySlotState, "h0e0m0")).toBe(true);
    });

    it("refuses to drop a tile the tray doesn't have", () => {
      expect(canDropTile(emptySlotState, "h2e2m2")).toBe(false);
    });

    it("refuses to drop into an occupied slot", () => {
      const occupied: FaceSwatchBoardState = {
        ...emptySlotState,
        slotTileId: "h1e1m1",
      };
      expect(canDropTile(occupied, "h0e0m0")).toBe(false);
    });
  });

  describe("dropTile", () => {
    it("moves a tile from tray to slot", () => {
      expect(dropTile(emptySlotState, "h0e0m0")).toEqual({
        trayTileIds: ["h1e1m1"],
        slotTileId: "h0e0m0",
      });
    });

    it("is a no-op when the drop is illegal", () => {
      const occupied: FaceSwatchBoardState = {
        ...emptySlotState,
        slotTileId: "h1e1m1",
      };
      expect(dropTile(occupied, "h0e0m0")).toBe(occupied);
    });
  });

  describe("returnSlotTile", () => {
    it("returns the slot tile to the tray", () => {
      const filled: FaceSwatchBoardState = {
        trayTileIds: ["h1e1m1"],
        slotTileId: "h0e0m0",
      };
      expect(returnSlotTile(filled)).toEqual({
        trayTileIds: ["h1e1m1", "h0e0m0"],
        slotTileId: null,
      });
    });

    it("is a no-op when the slot is already empty", () => {
      expect(returnSlotTile(emptySlotState)).toBe(emptySlotState);
    });
  });

  describe("faceTileImageSrc", () => {
    it("builds the public face image path", () => {
      expect(faceTileImageSrc("h0e1m2")).toBe("/faces/h0e1m2.png");
    });
  });
});
