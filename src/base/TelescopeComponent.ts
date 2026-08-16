import { Telescope } from "telescopejs";

export interface TelescopedProps<T> {
  readonly state: T;
  readonly telescope: Telescope<T>;
}

export type TelescopeComponent<T> = (
  props: TelescopedProps<T>,
) => React.ReactElement;

export type ViewModelHook<T, out V> = (props: TelescopedProps<T>) => V;

export type FractalComponentBuilder = <TState, TViewModel>(
  buildViewModelHook: ViewModelHook<TState, TViewModel>,
  toVirtualElement: (viewModel: TViewModel) => React.JSX.Element,
) => (props: TelescopedProps<TState>) => React.JSX.Element;

export const buildFractalComponent: FractalComponentBuilder =
  <TState, TViewModel>(
    buildViewModelHook: ViewModelHook<TState, TViewModel>,
    toVirtualElement: (viewModel: TViewModel) => React.JSX.Element,
  ) =>
  (props: TelescopedProps<TState>) =>
    toVirtualElement(buildViewModelHook(props));
