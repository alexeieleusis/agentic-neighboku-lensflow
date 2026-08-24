import { afterEach, describe, expect, it } from "vitest";
import { render, renderHook, cleanup } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { firstValueFrom } from "rxjs";
import { Telescope } from "telescopejs";
import { createPiece } from "../../../game/entities";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { DraggablePiece } from "../DraggablePiece";
import type { DraggablePieceState } from "../DraggablePiece.types";
import { useDraggablePieceViewModel } from "../useDraggablePieceViewModel";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
});

function pieceState(
  digits: readonly number[],
  size = 48,
): TelescopedProps<DraggablePieceState> {
  const state: DraggablePieceState = {
    piece: createPiece(digits, 3, 3),
    size,
  };
  return { state, telescope: Telescope.of(state) };
}

function dndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
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
    });
    await expect(
      firstValueFrom(result.current.pieceImage.telescope.stream),
    ).resolves.toEqual({
      piece: props.state.piece,
      size: 48,
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
    expect(Object.keys(result.current.listeners ?? {})).toContain("onPointerDown");
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
    expect(dragNode).not.toBeNull();
    expect(dragNode!.getAttribute("tabindex")).toBe("0");
    expect(dragNode!.getAttribute("aria-roledescription")).toBe("draggable");

    // The piece image renders via the Phase 6 PieceDisplay at the requested size,
    // inside the drag node.
    const svg = dragNode!.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("width")).toBe("48");
    expect(svg!.querySelector("title")?.textContent).toBe(
      "circle, red border, aquamarine fill",
    );
  });
});
