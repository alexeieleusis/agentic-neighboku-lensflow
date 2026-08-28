import { useState } from "react";
import type { TelescopedProps } from "../../base/TelescopeComponent.ts";
import type {
  NewGamePanelSelection,
  NewGamePanelState,
} from "./NewGamePanel.types.ts";
import {
  DEFAULT_BOARD_SIZE,
  initialDimension,
} from "./useNewGamePanelDomain.ts";

/**
 * The internal (state-tier) shape `useNewGamePanelState` returns to the
 * orchestrator (`useNewGamePanelViewModel`) and the action tier
 * (`useNewGamePanelActions`) — includes the selection setter, which the
 * orchestrator strips before the public view model reaches
 * `RenderNewGamePanel` (docs/CONVENTIONS.md split-hook rule: internal shapes
 * may carry more than the public view model, but the other way around is
 * where setters leak).
 */
export interface NewGamePanelStateInternal {
  /**
   * §4.1/§5.9 — the panel's pending selection: the size the select shows
   * plus the dimension the §4.1 rule computes for it. The single local fact
   * this panel owns — both halves move together on one select change, so one
   * setter, not two.
   */
  readonly selection: NewGamePanelSelection;
  readonly setSelection: (selection: NewGamePanelSelection) => void;
}

/**
 * The state tier of Phase 17's non-trivial split (requirements §7.2.1,
 * docs/CONVENTIONS.md): the panel's one piece of local, non-telescope UI
 * state — the pending board-size selection — plus the derived initial
 * dimension read off the magnified slice via the pure domain tier.
 *
 * §5.9: "On first open, the Board Size select defaults to 8×8." The
 * initializer runs at mount, and the panel mounts fresh each time the drawer
 * opens (a closed MUI Drawer renders nothing at all — the same mount
 * behavior the Phase 16 drawer tests assert), so every open re-defaults the
 * select to 8×8 and re-reads the shell's current dimension as §4.1's "prior
 * value". No reset effect is needed: the unmount IS the reset.
 */
export function useNewGamePanelState(
  props: Readonly<TelescopedProps<NewGamePanelState>>,
): NewGamePanelStateInternal {
  const [selection, setSelection] = useState<NewGamePanelSelection>(() => ({
    size: DEFAULT_BOARD_SIZE,
    dimension: initialDimension(props.state.dimension),
  }));

  return { selection, setSelection };
}
