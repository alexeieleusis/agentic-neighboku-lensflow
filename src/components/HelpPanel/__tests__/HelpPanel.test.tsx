import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Telescope } from "telescopejs";
import { darkTheme } from "../../../theme";
import { HelpPanel } from "../HelpPanel";
import type { HelpPanelState } from "../HelpPanel.types";
import {
  ENGLISH_TUTORIAL_VIDEO_URL,
  FREPIK_ATTRIBUTION_URL,
  SPANISH_TUTORIAL_VIDEO_URL,
} from "../useHelpPanelDomain";

// @testing-library/react's auto-cleanup only hooks in when Vitest's `globals`
// mode is on; here it is off, so unmount explicitly (the repo's convention).
afterEach(() => {
  cleanup();
});

function renderHelpPanel({
  base = 3,
  dimension = 3,
  pieceType = "Shapes",
}: Partial<HelpPanelState> = {}) {
  const state: HelpPanelState = { base, dimension, pieceType };
  return render(
    <ThemeProvider theme={darkTheme}>
      <HelpPanel state={state} telescope={Telescope.of(state)} />
    </ThemeProvider>,
  );
}

/** `a` precedes `b` in document order (the §5.10 section-order assertions). */
function expectBefore(a: Element, b: Element): void {
  expect(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
    Node.DOCUMENT_POSITION_PRECEDING,
  );
}

/** The group root `Stack` that owns the heading with `title` text. */
function groupRoot(title: string): HTMLElement {
  const heading = screen.getByText(title).parentElement;
  if (heading === null) throw new Error(`fixture: ${title} has no parent`);
  const root = heading.parentElement;
  if (root === null) throw new Error(`fixture: ${title} group has no root`);
  return root;
}

/**
 * The piece images a group renders in Shapes mode: each shared `PieceDisplay`
 * is an accessible image whose SVG carries a `<title>` child (its aria label).
 * The group's own heading icon is an SVG too, but a MUI icon without a
 * `<title>`, so the tag filters it out.
 */
function groupPieceImages(title: string): SVGElement[] {
  return Array.from(groupRoot(title).querySelectorAll("svg")).filter((svg) => {
    const first = svg.firstElementChild;
    return first !== null && first.tagName === "title";
  });
}

/**
 * The piece images a group renders in Faces mode: each shared `PieceDisplay`
 * is an `<img>` whose `src` is the §5.4 face file name and whose `alt` carries
 * the face's accessible name.
 */
function groupFaceImages(title: string): HTMLImageElement[] {
  return Array.from(
    groupRoot(title).querySelectorAll("img"),
  ) as HTMLImageElement[];
}

/**
 * The open Select's option whose value is `value`: MUI tags each option with
 * `data-value` (the option's `value` prop — here, the piece's digit label).
 * The accessible name is NOT a stable handle: the shared piece image's
 * `<title>` ("circle, red border, aquamarine fill") prefixes the digit
 * label in the computed name.
 */
function optionWithValue(value: string): HTMLElement {
  const option = screen
    .getAllByRole("option")
    .find((o) => o.dataset.value === value);
  if (option === undefined) {
    throw new Error(`fixture: no option with data-value ${value}`);
  }
  return option;
}

describe("HelpPanel (§5.10 — the six sections in order)", () => {
  it("renders the no-selection placeholder state with all three static links, in the spec's exact order", () => {
    renderHelpPanel();

    // §5.10 item 1: the piece selector, displaying the no-selection value.
    expect(screen.getByRole("combobox").textContent).toContain(
      "Select a piece",
    );

    // §5.10 items 2/3: both neighbor groupings, each in its placeholder state.
    expect(screen.getByText("Valid neighbors")).toBeTruthy();
    expect(screen.getByText("Invalid neighbors")).toBeTruthy();
    expect(
      screen.getByText("Select a piece to see its valid neighbors"),
    ).toBeTruthy();
    expect(
      screen.getByText("Select a piece to see its invalid neighbors"),
    ).toBeTruthy();

    // §5.10 items 4/5/6: the two tutorial-video links (separately labeled, real
    // non-placeholder targets) and the Freepik credit — the credit is present in
    // this Shapes-mode panel state, unconditionally: §5.10 item 6 renders it
    // regardless of `pieceType` (the Faces-mode test below pins the same).
    const english = screen.getByRole("link", { name: "Tutorial in English" });
    expect(english.getAttribute("href")).toBe(ENGLISH_TUTORIAL_VIDEO_URL);
    expect(english.getAttribute("target")).toBe("_blank");
    const spanish = screen.getByRole("link", { name: "Tutorial en Español" });
    expect(spanish.getAttribute("href")).toBe(SPANISH_TUTORIAL_VIDEO_URL);
    const freepik = screen.getByRole("link", {
      name: "Images under license by Freep!k",
    });
    expect(freepik.getAttribute("href")).toBe(FREPIK_ATTRIBUTION_URL);

    // §5.10's exact order: selector → valid group → invalid group → English
    // link → Spanish link → Freepik credit.
    const selector = screen.getByRole("combobox");
    expectBefore(selector, groupRoot("Valid neighbors"));
    expectBefore(groupRoot("Valid neighbors"), groupRoot("Invalid neighbors"));
    expectBefore(groupRoot("Invalid neighbors"), english);
    expectBefore(english, spanish);
    expectBefore(spanish, freepik);
  });

  it("selecting a piece from the selector updates both neighbor groups to that piece's sets", () => {
    renderHelpPanel();

    // Open the MUI Select — MUI v9 renders its trigger as the listbox's
    // `role="combobox"`, and it opens on mousedown…
    fireEvent.mouseDown(screen.getByRole("combobox"));

    // …and pick the `0 1 1` option (by its MUI `data-value`, see
    // `optionWithValue`).
    fireEvent.click(optionWithValue("0 1 1"));

    // §3.2's exact rule at base 3, dimension 3: 12 valid neighbors, and the
    // candidate space's 27 − 12 = 15 invalid members (including the selected
    // piece itself).
    expect(groupPieceImages("Valid neighbors")).toHaveLength(12);
    expect(groupPieceImages("Invalid neighbors")).toHaveLength(15);
    // The placeholders are gone — both groups now render pieces.
    expect(
      screen.queryByText("Select a piece to see its valid neighbors"),
    ).toBeNull();
    // And the closed selector now displays the selection's digit label.
    expect(screen.getByRole("combobox").textContent).toContain("0 1 1");
  });

  it("renders a 9-piece candidate space at dimension 2, with 4/4 neighbor split", () => {
    renderHelpPanel({ base: 3, dimension: 2 });

    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");
    // The no-selection option plus the 9 candidate pieces.
    expect(options).toHaveLength(10);

    fireEvent.click(optionWithValue("1 1"));
    // [1,1]'s valid neighbors at base 3, dimension 2: [1,0], [1,2], [0,1],
    // [2,1] — 4 valid, and 9 − 4 = 5 invalid (the selected piece included).
    expect(groupPieceImages("Valid neighbors")).toHaveLength(4);
    expect(groupPieceImages("Invalid neighbors")).toHaveLength(5);
  });
});

describe("HelpPanel (§5.4 Faces mode)", () => {
  it("renders the selector options and both neighbor groups as face images when pieceType is Faces", () => {
    renderHelpPanel({ pieceType: "Faces" });

    // The closed selector's options each carry a face image (§5.4: the shared
    // PieceDisplay's Faces branch — no separate Faces path in the panel).
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(28); // no-selection option + 27 pieces
    for (const option of options.slice(1)) {
      const img = option.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toMatch(
        /^\/faces\/h[0-2]e[0-2]m[0-2]\.png$/,
      );
    }
    fireEvent.click(optionWithValue("0 1 1"));

    // The two neighbor groups render faces, not shapes…
    const validFaces = groupFaceImages("Valid neighbors");
    const invalidFaces = groupFaceImages("Invalid neighbors");
    expect(validFaces).toHaveLength(12);
    expect(invalidFaces).toHaveLength(15);
    expect(groupPieceImages("Valid neighbors")).toHaveLength(0);
    expect(groupPieceImages("Invalid neighbors")).toHaveLength(0);
    // …with the §5.4 file names for each group member's own piece digits.
    const validSrcs = new Set(validFaces.map((img) => img.getAttribute("src")));
    const invalidSrcs = new Set(
      invalidFaces.map((img) => img.getAttribute("src")),
    );
    expect(validSrcs.size).toBe(12);
    expect(invalidSrcs.size).toBe(15);
    for (const src of [...validSrcs, ...invalidSrcs]) {
      expect(src).toMatch(/^\/faces\/h[0-2]e[0-2]m[0-2]\.png$/);
    }
    // The selected piece's face ([0,1,1]) is on the invalid side (a piece is
    // never its own valid neighbor), under its exact §5.4 name.
    expect(invalidSrcs.has("/faces/h0e1m1.png")).toBe(true);
    expect(validSrcs.has("/faces/h0e1m1.png")).toBe(false);
  });

  it("still shows the Freepik attribution link in Faces mode (the credit is unconditional, §5.10 item 6)", () => {
    renderHelpPanel({ pieceType: "Faces" });

    const freepik = screen.getByRole("link", {
      name: "Images under license by Freep!k",
    });
    expect(freepik.getAttribute("href")).toBe(FREPIK_ATTRIBUTION_URL);
  });
});
