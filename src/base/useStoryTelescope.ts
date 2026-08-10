import { useState } from "react";
import { Telescope } from "telescopejs";
import { useTelescopeState } from "./useTelescopeState";

/**
 * Host-only, like `useTelescopeState`: builds a standalone `Telescope.of(initialState)`
 * once at mount (from the story's args) and subscribes to it. Shared by every story's
 * host component so each one only supplies its own state shape.
 */
export function useStoryTelescope<T>(initialState: T): {
  readonly state: T;
  readonly telescope: Telescope<T>;
} {
  const [telescope] = useState(() => Telescope.of<T>(initialState));
  const state = useTelescopeState(telescope, initialState);

  return { state, telescope };
}
