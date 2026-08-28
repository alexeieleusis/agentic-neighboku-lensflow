import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Telescope } from "telescopejs";
import { useTelescopeState } from "../../../base/useTelescopeState";
import type { TelescopedProps } from "../../../base/TelescopeComponent";
import { NewGamePanel } from "../NewGamePanel";
import type { NewGamePanelState } from "../NewGamePanel.types";
import { darkTheme } from "../../../theme";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals`
// mode is on; here it is off, so unmount explicitly (same convention as the
// Phase 5/7/15/16 tests).
afterEach(() => {
  cleanup();
});

/**
 * §4.2-shaped slice fixture: a shell whose current game is 4×4 (dimension 3,
 * base 3 — the §8.5 load-time forced dimension), with the clock origin
 * back-dated one hour so the Start commit's fresh `startTime` is
 * distinguishable from it.
 */
const SLICE = {
  size: 4,
  dimension: 3,
  base: 3,
  startTime: Date.now() - 3_600_000,
} satisfies NewGamePanelState;

/**
 * The slice's host: `main.tsx`'s root subscription factored into a component
 * for the test harness — `NewGamePanel` is snapshot-in, telescope-out
 * (requirements §7.2), so a test that commits through the slice sees the
 * panel re-render only through this same subscription path.
 */
function PanelHarness(
  props: TelescopedProps<NewGamePanelState>,
): React.ReactElement {
  const state = useTelescopeState(props.telescope, props.state);
  return <NewGamePanel state={state} telescope={props.telescope} />;
}

function renderPanel(initial: NewGamePanelState = SLICE) {
  const telescope = Telescope.of(initial);
  const emissions: NewGamePanelState[] = [];
  const subscription = telescope.stream.subscribe((s) => emissions.push(s));
  const utils = render(
    <ThemeProvider theme={darkTheme}>
      <PanelHarness state={initial} telescope={telescope} />
    </ThemeProvider>,
  );
  return { ...utils, telescope, emissions, subscription };
}

/**
 * Open the MUI Select's menu: v9's non-native Select opens on the display
 * node's `onMouseDown` (not `onClick`), and the option's value commits on
 * the option's `onClick` (`handleItemClick`).
 */
function openSizeSelect() {
  fireEvent.mouseDown(screen.getByRole("combobox"));
}

function pickSize(size: number) {
  openSizeSelect();
  fireEvent.click(screen.getByRole("option", { name: `${size}×${size}` }));
}

/** The select display node's current reading (the rendered selected value). */
function displayedSize(): string {
  return screen.getByRole("combobox").textContent ?? "";
}

describe("NewGamePanel (§5.9)", () => {
  it("renders one Board Size select with the five §4.1 options and a Start button", () => {
    renderPanel();

    // The panel's two controls, §5.9: "A single Board Size select … and a
    // Start button."
    const select = screen.getByRole("combobox");
    const start = screen.getByRole("button", { name: "Start" });
    expect(select).toBeTruthy();
    expect(start).toBeTruthy();

    // Open the menu: exactly the five §4.1 options, in order, no more.
    openSizeSelect();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "4×4",
      "6×6",
      "8×8",
      "9×9",
      "12×12",
    ]);
  });

  it("defaults the select to §5.9's first-open 8×8 even when the slice holds another size", () => {
    // The slice says the current game is 4×4 — the select still opens on
    // 8×8 (§5.9: "On first open, the Board Size select defaults to 8×8").
    renderPanel(SLICE);
    expect(displayedSize()).toBe("8×8");
  });

  it("start with the default selection commits the slice's dimension through the slice telescope with a fresh startTime and the shell's base", () => {
    const { emissions, subscription } = renderPanel(SLICE);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    // Replayed initial state + exactly one committed Start.
    expect(emissions).toHaveLength(2);
    const commit = emissions[1];
    expect(commit).not.toBe(SLICE);
    expect(commit.size).toBe(8); // the §5.9 first-open default
    expect(commit.dimension).toBe(3); // §4.1: 8 >= 8 keeps/forces the slice's 3
    expect(commit.base).toBe(3); // §4.1: base carried through, never changed
    expect(commit.startTime).toBeGreaterThan(SLICE.startTime);
    expect(commit.startTime).toBeLessThanOrEqual(Date.now());
    subscription.unsubscribe();
  });

  it("selecting 4×4 keeps the slice's dimension, then Start commits it (§4.1 size < 8: unchanged)", () => {
    const { emissions, subscription } = renderPanel(SLICE);

    pickSize(4);
    expect(displayedSize()).toBe("4×4");
    // §4.1: selecting a size on its own moves no shell state — no commit.
    expect(emissions).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(emissions).toHaveLength(2);
    expect(emissions[1]).toEqual({
      size: 4,
      dimension: 3, // unchanged from the slice's held 3
      base: 3,
      startTime: emissions[1].startTime,
    });
    expect(emissions[1].startTime).toBeGreaterThan(SLICE.startTime);
    subscription.unsubscribe();
  });

  it("applies §4.1's asymmetric rule through the panel: 4×4 keeps a held dimension 2, 12×12 forces it to 3, and 6×6 afterwards keeps the 3", () => {
    const { emissions, subscription } = renderPanel({
      ...SLICE,
      dimension: 2,
    });

    // 4×4 with the slice holding dimension 2: §4.1's "left unchanged".
    pickSize(4);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(emissions[1].dimension).toBe(2);

    // 12×12: §4.1 forces the dimension to 3.
    pickSize(12);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(emissions[2].dimension).toBe(3);
    expect(emissions[2].size).toBe(12);

    // 6×6 after that: the dimension is left unchanged — still the forced 3,
    // never pulled back to the earlier 2 (the asymmetry §4.1 says to carry
    // forward exactly).
    pickSize(6);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(emissions[3].size).toBe(6);
    expect(emissions[3].dimension).toBe(3);
    subscription.unsubscribe();
  });
});
