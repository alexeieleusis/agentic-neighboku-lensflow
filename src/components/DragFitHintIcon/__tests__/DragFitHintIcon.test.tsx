import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import type { DragHint } from "../../DraggablePiece/DraggablePiece.types";
import { DragFitHintIcon } from "../DragFitHintIcon";
import { useDragFitHintIconViewModel } from "../useDragFitHintIconViewModel";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
});

function hintProps(hint: DragHint): TelescopedProps<DragHint> {
  return { state: hint, telescope: Telescope.of(hint) };
}

function iconSvgFor(hint: DragHint): SVGElement {
  render(<DragFitHintIcon {...hintProps(hint)} />);
  const ariaLabel = {
    None: "No piece is being dragged",
    Unknown: "Piece is being dragged",
    Ok: "Dragged piece fits",
    NotOk: "Dragged piece does not fit",
  } satisfies Record<DragHint, string>;
  const slot = screen.getByRole("button", { name: ariaLabel[hint] });
  const svg = slot.querySelector("svg");
  if (svg === null) throw new Error(`expected an icon svg in the ${hint} slot`);
  return svg;
}

describe("useDragFitHintIconViewModel (§5.6 / Phase 14 hint → presentation)", () => {
  it("maps every DragHint value to its accessibility label and color", () => {
    const cases: readonly [DragHint, string, string][] = [
      ["None", "No piece is being dragged", "text.primary"],
      ["Unknown", "Piece is being dragged", "text.primary"],
      ["Ok", "Dragged piece fits", "success.main"],
      ["NotOk", "Dragged piece does not fit", "error.main"],
    ];
    for (const [hint, label, color] of cases) {
      const { result } = renderHook(() =>
        useDragFitHintIconViewModel(hintProps(hint)),
      );
      expect(result.current.hint).toBe(hint);
      expect(result.current.ariaLabel).toBe(label);
      expect(result.current.color).toBe(color);
    }
  });
});

describe("DragFitHintIcon (§5.6 / Phase 14 top-bar slot)", () => {
  it("renders the three documented visual states: info (None/Unknown), thumbs-up (Ok), thumbs-down (NotOk)", () => {
    // `None` and `Unknown` are visually the same undetermined state — the same info
    // icon — while `Ok`/`NotOk` are the two distinct determined icons.
    const none = iconSvgFor("None");
    const unknown = iconSvgFor("Unknown");
    const ok = iconSvgFor("Ok");
    const notOk = iconSvgFor("NotOk");

    expect(none.innerHTML).toBe(unknown.innerHTML);
    expect(ok.innerHTML).not.toBe(notOk.innerHTML);
    expect(ok.innerHTML).not.toBe(none.innerHTML);
  });

  it("announces the hint politely from its slot (`aria-live`) in every state", () => {
    for (const hint of ["None", "Unknown", "Ok", "NotOk"] as const) {
      cleanup();
      render(<DragFitHintIcon {...hintProps(hint)} />);
      // The slot is the first top-bar element: it must be findable by its label in
      // every state, and re-announce changes politely.
      const slot = screen.getByRole("button", {
        name:
          hint === "None"
            ? "No piece is being dragged"
            : hint === "Unknown"
              ? "Piece is being dragged"
              : hint === "Ok"
                ? "Dragged piece fits"
                : "Dragged piece does not fit",
      });
      expect(slot.getAttribute("aria-live")).toBe("polite");
    }
  });
});
