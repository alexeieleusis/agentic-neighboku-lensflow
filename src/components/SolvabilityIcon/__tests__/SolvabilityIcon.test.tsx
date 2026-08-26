import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, renderHook } from "@testing-library/react";
import { Telescope } from "telescopejs";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { SolvabilityIcon } from "../SolvabilityIcon";
import { useSolvabilityIconViewModel } from "../useSolvabilityIconViewModel";
import type { SolvabilityIconState } from "../SolvabilityIcon.types";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals` mode is
// on; here it is off, so unmount explicitly (same convention as the Phase 5/7 tests).
afterEach(() => {
  cleanup();
});

function sliceProps(
  slice: SolvabilityIconState,
): TelescopedProps<SolvabilityIconState> {
  return { state: slice, telescope: Telescope.of(slice) };
}

/**
 * The indicator's icon, looked up by its announced label. MUI's `SvgIcon`
 * renders no `role` attribute of its own here (no `titleAccess`), so the
 * `aria-label` is the slot's query surface — the same one a screen reader
 * would use.
 */
function iconFor(label: string): SVGElement {
  const icon = document.querySelector<SVGElement>(`svg[aria-label="${label}"]`);
  if (icon === null)
    throw new Error(`expected the ${JSON.stringify(label)} indicator`);
  return icon;
}

describe("useSolvabilityIconViewModel (§5.13 / Phase 15 slice → presentation)", () => {
  it("maps every slice pair to its accessibility label and color", () => {
    const cases: readonly [SolvabilityIconState, string, string][] = [
      [
        { visible: true, solvable: true },
        "Position is solvable",
        "success.main",
      ],
      [{ visible: true, solvable: false }, "No solution exists", "error.main"],
      // Hidden: no label is announced (nothing is rendered); the color is
      // inert but still derived from the solvability flag.
      [{ visible: false, solvable: true }, "", "success.main"],
      [{ visible: false, solvable: false }, "", "error.main"],
    ];
    for (const [slice, label, color] of cases) {
      const { result } = renderHook(() =>
        useSolvabilityIconViewModel(sliceProps(slice)),
      );
      expect(result.current.visible).toBe(slice.visible);
      expect(result.current.solvable).toBe(slice.solvable);
      expect(result.current.ariaLabel).toBe(label);
      expect(result.current.color).toBe(color);
    }
  });
});

describe("SolvabilityIcon (§5.13 / Phase 15 top-bar slot)", () => {
  it("renders the happy face (CheckCircle) when visible and solvable, announced politely", () => {
    render(
      <SolvabilityIcon {...sliceProps({ visible: true, solvable: true })} />,
    );
    const icon = iconFor("Position is solvable");
    expect(icon.getAttribute("aria-live")).toBe("polite");
    // §5.1: the solvable face is the `CheckCircle` glyph — a circle with a
    // check path (as opposed to the unsolvable face's warning-triangle
    // path, asserted distinct below).
    expect(icon.innerHTML).toContain("path");
  });

  it("renders the sad face (ReportProblem) when visible and unsolvable, announced politely", () => {
    render(
      <SolvabilityIcon {...sliceProps({ visible: true, solvable: false })} />,
    );
    const icon = iconFor("No solution exists");
    expect(icon.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the two visible faces as distinct icons", () => {
    render(
      <SolvabilityIcon {...sliceProps({ visible: true, solvable: true })} />,
    );
    const happy = iconFor("Position is solvable");
    cleanup();
    render(
      <SolvabilityIcon {...sliceProps({ visible: true, solvable: false })} />,
    );
    const sad = iconFor("No solution exists");
    expect(happy.innerHTML).not.toBe(sad.innerHTML);
  });

  it("renders nothing at all when the preference is off, regardless of solvability", () => {
    for (const solvable of [true, false]) {
      cleanup();
      const utils = render(
        <SolvabilityIcon {...sliceProps({ visible: false, solvable })} />,
      );
      // §5.13: "nothing is shown when the preference is off" — no icon, no
      // announcement surface, no placeholder node.
      expect(document.querySelector("svg")).toBeNull();
      expect(utils.container.innerHTML).toBe("");
    }
  });
});
