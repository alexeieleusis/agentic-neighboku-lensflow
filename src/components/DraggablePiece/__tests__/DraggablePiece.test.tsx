import { afterEach, describe, expect, it } from "vitest";
import { render, renderHook, cleanup } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { firstValueFrom } from "rxjs";
import { Telescope } from "telescopejs";
import { createPiece } from "../../../game/entities";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { DraggablePiece } from "../DraggablePiece";
import type { PieceDisplayState } from "../../PieceDisplay/PieceDisplay.types";
import { useDraggablePieceViewModel } from "../useDraggablePieceViewModel";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
});

function pieceState(
  digits: readonly number[],
  size = 48,
  pieceType: "Shapes" | "Faces" = "Shapes",
): TelescopedProps<PieceDisplayState> {
  const state: PieceDisplayState = {
    piece: createPiece(digits, 3, 3),
    size,
    pieceType,
  };
  return { state, telescope: Telescope.of(state) };
}

function dndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

// Narrow a queried node from `T | null` to `T`, failing the test with a readable message
// at the invariant site — in place of the unchecked non-null assertion (`!`).
function assertNode<T>(value: T | null, what: string): asserts value is T {
  if (value === null)
    throw new Error(`Expected ${what} in the rendered output`);
}

// Narrow an optional value (e.g. dnd-kit's `listeners`) from `T | undefined` to `T`
// with the same readable failure mode.
function assertDefined<T>(
  value: T | undefined,
  what: string,
): asserts value is T {
  if (value === undefined)
    throw new Error(`Expected ${what} to be defined by the hook`);
}

describe("useDraggablePieceViewModel", () => {
  it("hands the wrapped PieceDisplay a live magnified piece-image slice", async () => {
    const props = pieceState([0, 2, 0]);
    const { result } = renderHook(() => useDraggablePieceViewModel(props), {
      wrapper: dndWrapper,
    });

    expect(result.current.pieceImage.state).toEqual({
      piece: props.state.piece,
      size: 48,
      pieceType: "Shapes",
    });
    await expect(
      firstValueFrom(result.current.pieceImage.telescope.stream),
    ).resolves.toEqual({
      piece: props.state.piece,
      size: 48,
      pieceType: "Shapes",
    });
  });

  it("exposes the useDraggable registration surface, at rest", () => {
    const props = pieceState([1, 0, 1]);
    const { result } = renderHook(() => useDraggablePieceViewModel(props), {
      wrapper: dndWrapper,
    });

    expect(typeof result.current.dragNodeRef).toBe("function");
    expect(result.current.isDragging).toBe(false);
    expect(result.current.attributes.role).toBe("button");
    expect(result.current.attributes.tabIndex).toBe(0);
    expect(result.current.attributes["aria-roledescription"]).toBe("draggable");
    // Registered under the wrapper DndContext with its default PointerSensor: the
    // activation listener is present, so picking the element up with the pointer starts
    // a drag (§5.6's desktop-pointer path).
    expect(result.current.listeners).toBeTruthy();
    const listeners = result.current.listeners;
    assertDefined(listeners, "a useDraggable activation listener map");
    expect(Object.keys(listeners)).toContain("onPointerDown");
    expect(result.current.dragStyle.touchAction).toBe("none");
    expect(result.current.dragStyle.cursor).toBe("grab");
    expect(result.current.dragStyle.transform).toBeUndefined();
  });
});

describe("DraggablePiece (§5.6 tray drag node)", () => {
  it("registers as a dnd-kit draggable node rendering the shared PieceDisplay", () => {
    const { container } = render(
      <DndContext>
        <DraggablePiece {...pieceState([0, 0, 0])} />
      </DndContext>,
    );

    // The dnd-kit attributes spread onto the root element: a focusable, announced
    // draggable (the node ref + listeners ride the same element, wired in the
    // view-model).
    const dragNode = container.querySelector<HTMLElement>('[role="button"]');
    assertNode(dragNode, "a [role=button] drag node");
    expect(dragNode.getAttribute("tabindex")).toBe("0");
    expect(dragNode.getAttribute("aria-roledescription")).toBe("draggable");

    // The piece image renders via the Phase 6 PieceDisplay at the requested size,
    // inside the drag node.
    const svg = dragNode.querySelector("svg");
    assertNode(svg, "an svg PieceDisplay");
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.querySelector("title")?.textContent).toBe(
      "circle, red border, aquamarine fill",
    );
  });

  it("renders the SVG at the requested non-default size", () => {
    // Every other test in this suite renders the default size; this one pins the
    // size prop's path so a hardcoded-size regression in DraggablePiece or
    // PieceDisplay is caught.
    const { container } = render(
      <DndContext>
        <DraggablePiece {...pieceState([0, 0, 0], 64)} />
      </DndContext>,
    );

    const svg = container.querySelector("svg");
    assertNode(svg, "an svg PieceDisplay");
    expect(svg.getAttribute("width")).toBe("64");
  });
});
