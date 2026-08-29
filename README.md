# Neighboku

Neighboku is a single-player browser puzzle that fuses **Sudoku** with the
attribute-matching mechanic of _Spot It!_. Pieces are placed on a square grid from a
shared tray, and two rules must hold simultaneously:

- **Sudoku constraint** — no two identical pieces share a row, column, or section.
  A board is tiled into `sectionSize × sectionSize` sections, where `sectionSize` is
  the **largest prime factor of the board size** (size 9 → 3×3 sections, size 8 → 2×2,
  a prime size is a single section covering the whole board).
- **Neighbor rule** — every pair of orthogonally-adjacent pieces (up, down, left,
  right) must share **exactly one** attribute: not zero, not more than one.

The goal is to place every piece from the tray onto the board. When the tray empties,
the game is finished: if the play stayed legal and the final position was solvable,
you win (the finished dialog shows the elapsed time); otherwise the dialog reports
that no solution exists, and the intended recovery is to press **Undo** until the
solvability indicator turns positive again.

> Note: the original project's in-app doc and tutorial video describe the neighbor rule
> as applying to diagonal cells as well; the shipped behavior is orthogonal-only, and
> this description matches the shipped behavior (see
> [`docs/neighboku-ai-rebuild/requirements.md`](docs/neighboku-ai-rebuild/requirements.md)
> §8.1).

## Playing

- **Drag and drop** — pick a piece up from the tray and drop it on a board cell.
  Works with a desktop pointer/pen and with mobile touch (on touch, hold the piece
  briefly to start the drag).
- **Keyboard** — focus a tray piece, press Space/Enter to pick it up, move it with
  the arrow keys, and drop it with Space.
- **Click to place** — with the _Hint Piece Cells_ preference on, each tray column
  lists a button per legal cell (labeled `row,column`); clicking one places the piece
  there. This is the no-drag alternative.
- **Undo** — the top-bar undo button takes back your last placement (disabled when
  there is nothing to undo).
- **New game** — the top-bar new-game button opens the New Game panel: pick a board
  size (**4×4, 6×6, 8×8, 9×9, 12×12, 16×16**) and press Start. Sizes 8×8 and up force
  the pieces to the 3-attribute (Shapes/Faces-compatible) space; smaller sizes keep
  the current attribute count.
- **Preferences** — the top-bar gear opens the Preferences panel with one toggle per
  setting (see the hints table below, plus _Piece Type_ and _Sound_). Preferences are
  saved to `localStorage` and restored on the next load; the board itself is never
  saved — every page load starts a fresh board from the loaded preferences.
- **Help** — the top-bar help icon opens the Help panel: select any piece and the
  panel visually shows which other pieces **can** be its neighbors (valid neighbors)
  and which **cannot** (invalid neighbors), alongside the tutorial video links.

## Hints

Each hint is an independent preference, defaulting to the values shown:

| Hint                         | Preference default | What it does                                                                                                  |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Fit piece count              | on                 | Blank cells show how many tray pieces would legally fit there.                                                |
| Show fit pieces on hover     | on                 | Hovering/tapping a blank cell lists every piece that fits there.                                              |
| Fit piece unique cell        | on                 | A tray piece whose remaining count equals its number of legal cells gets a `*` — its placement is now forced. |
| Piece cells (click to place) | off                | Each tray column lists a button per legal fit-cell.                                                           |
| Fit on drag                  | on                 | While dragging, the top-bar icon shows a thumbs-up over a legal cell, a thumbs-down over an illegal one.      |
| Game is solvable             | on                 | The top-bar face is happy while the position is still solvable, sad otherwise.                                |
| Prevent invalid moves        | on                 | Invalid placements are rejected with an "Invalid move!" notice instead of being applied.                      |

The top-bar drag-fit icon (leftmost) is the _Fit on drag_ hint itself: the info
icon when no drag is in progress (or the fit is undetermined), a thumbs-up when the
dragged piece fits the cell under it, a thumbs-down when it does not.

## Pieces

A piece is a small vector of attribute digits — by default 3 digits of 3 values each
(27 distinct pieces). The two visual skins render the same underlying pieces:

- **Shapes** — digit 0 is the form (circle / triangle / square), digit 1 the border
  color (red / dodger blue / medium sea green), digit 2 the fill
  (aquamarine / yellow / purple). These are the attributes the neighbor rule operates
  on.
- **Faces** — a cartoon face image per piece (hair / eyes / mouth). The 27 face
  images are Freepik-licensed; the credit lives in the Help panel
  (re-verify the exact license terms before shipping publicly).

## Out of scope

No backend/server, accounts, multiplayer, leaderboards, scoring history,
monetization, analytics, or internationalization beyond the two hardcoded
tutorial-video links.

## Development

| Command                             | Does                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | Start the Vite dev server                          |
| `pnpm build`                        | Type-check (`tsc -b`) and build for production     |
| `pnpm lint`                         | ESLint                                             |
| `pnpm test` / `pnpm test run`       | Vitest (watch / single run)                        |
| `pnpm coverage`                     | Vitest with coverage                               |
| `pnpm storybook`                    | Storybook dev server (manual-verification catalog) |
| `pnpm build-storybook`              | Static Storybook build                             |
| `pnpm format` / `pnpm format:check` | Prettier write / check                             |

This repo is the LensFlow track of the
[Neighboku AI-rebuild experiment](docs/neighboku-ai-rebuild/00-overview.md): the game
was rebuilt phase by phase from the behavioral spec in
[`docs/neighboku-ai-rebuild/requirements.md`](docs/neighboku-ai-rebuild/requirements.md).
Read [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for how the fractal-component pattern
(`docs/fractal_component.md`) and the file-layout convention
(`docs/patterns/react/`) compose in this project; every stateful component follows
`state,telescope → useXViewModel → RenderX`, with parent→child state flowing through
magnified telescopes.
