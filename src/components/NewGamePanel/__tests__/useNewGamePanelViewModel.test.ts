import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import type { NewGamePanelState } from "../NewGamePanel.types";
import { useNewGamePanelViewModel } from "../useNewGamePanelViewModel";
import { BOARD_SIZES } from "../useNewGamePanelDomain";

/**
 * A §4.2-shaped slice fixture: the shell's current game is 4×4 (dimension 3,
 * base 3 — §8.5's load-time forced dimension), clock origin back-dated one
 * hour so a Start commit's fresh `startTime` is distinguishable from it.
 */
const SLICE = {
  size: 4,
  dimension: 3,
  base: 3,
  startTime: 1_000_000,
} satisfies NewGamePanelState;

/**
 * Render `useNewGamePanelViewModel` against a standalone slice telescope
 * (the panel's slice IS its whole state — no shell needed to exercise the
 * orchestrator): a commit through it re-emits exactly the written slice
 * value, so the emissions record the panel's Start payloads verbatim.
 */
function renderViewModel(initial: NewGamePanelState = SLICE) {
  const telescope = Telescope.of(initial);
  const emissions: NewGamePanelState[] = [];
  const subscription = telescope.stream.subscribe((s) => emissions.push(s));
  const { result, rerender } = renderHook(
    (state: NewGamePanelState) =>
      useNewGamePanelViewModel({
        state,
        telescope,
      } satisfies TelescopedProps<NewGamePanelState>),
    { initialProps: initial },
  );
  return { result, rerender, telescope, emissions, subscription };
}

describe("useNewGamePanelViewModel (Phase 17 orchestrator)", () => {
  it("exposes the five §4.1 sizes and §5.9's first-open default of 8×8, not the slice's own size", () => {
    const { result } = renderViewModel();

    expect(result.current.sizes).toEqual(BOARD_SIZES);
    expect(result.current.sizes).toEqual([4, 6, 8, 9, 12]);
    // The slice holds size 4 — the select still defaults to 8×8 (§5.9).
    expect(result.current.selectedSize).toBe(8);
  });

  it("onSizeChange applies §4.1's size→dimension rule locally and commits nothing", () => {
    const { result, emissions, subscription } = renderViewModel();

    act(() => {
      result.current.onSizeChange(4);
    });
    expect(result.current.selectedSize).toBe(4);
    // §4.1: size < 8 leaves the held dimension (the slice's 3) unchanged.
    act(() => {
      result.current.onSizeChange(6);
    });
    expect(result.current.selectedSize).toBe(6);
    act(() => {
      result.current.onSizeChange(12);
    });
    expect(result.current.selectedSize).toBe(12);
    // None of the selections moved any shell state: only the replayed
    // initial state was emitted.
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toBe(SLICE);
    subscription.unsubscribe();
  });

  it("initializes the pending dimension from the slice's current value (§4.1: 'left unchanged, whatever it currently is')", () => {
    // Slice dimension 2: selecting 4×4 keeps the 2.
    const dim2 = renderViewModel({ ...SLICE, dimension: 2 });
    act(() => {
      dim2.result.current.onSizeChange(4);
      dim2.result.current.onStart();
    });
    expect(dim2.emissions[1].dimension).toBe(2);
    dim2.subscription.unsubscribe();

    // Slice dimension 3: the same selection keeps the 3 instead.
    const dim3 = renderViewModel();
    act(() => {
      dim3.result.current.onSizeChange(4);
      dim3.result.current.onStart();
    });
    expect(dim3.emissions[1].dimension).toBe(3);
    dim3.subscription.unsubscribe();
  });

  it("forces the pending dimension to 3 when a size >= 8 is selected, whatever the slice holds", () => {
    const { result, emissions, subscription } = renderViewModel({
      ...SLICE,
      dimension: 2,
    });

    act(() => {
      result.current.onSizeChange(9);
    });
    act(() => {
      result.current.onStart();
    });

    expect(emissions[1].size).toBe(9);
    expect(emissions[1].dimension).toBe(3);
    expect(emissions[1].base).toBe(3);
    subscription.unsubscribe();
  });

  it("commits Start through the slice telescope: the pending selection, the shell's base, and a fresh startTime", () => {
    const { result, emissions, subscription } = renderViewModel();

    act(() => {
      result.current.onSizeChange(12);
    });
    const before = Date.now();
    act(() => {
      result.current.onStart();
    });

    // Replayed initial state + exactly one committed Start.
    expect(emissions).toHaveLength(2);
    const commit = emissions[1];
    expect(commit).not.toBe(SLICE);
    expect(commit.size).toBe(12);
    expect(commit.dimension).toBe(3); // 12 >= 8 forces it
    expect(commit.base).toBe(3); // §4.1: base never changed by the selector
    // A fresh clock reading, not the slice's back-dated origin.
    expect(commit.startTime).toBeGreaterThanOrEqual(before);
    expect(commit.startTime).toBeLessThanOrEqual(Date.now());
    expect(commit.startTime).not.toBe(SLICE.startTime);
    subscription.unsubscribe();
  });

  it("the pending selection is local state: a slice re-render (another emission) does not re-sync the select", () => {
    const { result, rerender, subscription } = renderViewModel();

    act(() => {
      result.current.onSizeChange(6);
    });
    expect(result.current.selectedSize).toBe(6);

    // The slice moves (e.g. a concurrent shell emission) — the panel's
    // pending selection keeps its own value; only a fresh mount re-defaults
    // it to 8×8.
    rerender({
      ...SLICE,
      size: 8,
      dimension: 3,
      base: 3,
      startTime: 2_000_000,
    });
    expect(result.current.selectedSize).toBe(6);
    subscription.unsubscribe();
  });
});
