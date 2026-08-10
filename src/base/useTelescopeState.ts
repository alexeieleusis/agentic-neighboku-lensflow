import { useEffect, useState } from "react";
import type { Telescope } from "telescopejs";

/**
 * Subscribes to a telescope's stream and triggers a re-render on each emission.
 *
 * The real app's `main.tsx` subscribes to the root telescope's stream once and calls
 * `root.render` imperatively on every emission — components below that point only ever
 * read a `state` snapshot prop, never a hook. Storybook (and tests) own their own React
 * root, so there's no `main.tsx` to do that subscription; this hook is the narrow,
 * host-only substitute for that same "subscribe and re-render" responsibility. Fractal
 * components themselves must never use this — they stay snapshot-in, telescope-out.
 */
export function useTelescopeState<T>(
  telescope: Telescope<T>,
  initialState: T,
): T {
  const [state, setState] = useState<T>(initialState);

  useEffect(() => {
    const subscription = telescope.stream.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [telescope]);

  return state;
}
