### Overview

Fractal components are inspired by the concept of fractals, where "zooming in" reveals a structure identical to the whole. In a fractal component hierarchy, this principle applies to the design and behavior of components: each child component follows the same structure as its parent. Every component receives a state along with its corresponding **telescope** (a mechanism for state management), uses a dedicated method to transform the state into a **view model**, and implements a render method.

The render method is purely declarative, performing no logic beyond the essentials required to assemble child elements. All props required by child components are precomputed and included in the view model, ensuring that components remain clean, consistent, and easy to reason about across all levels of the hierarchy.

This approach promotes modularity, reusability, and predictable behavior.

The code (TelescopeComponent) defines a concrete pattern for building **fractal components**. A fractal component is a reusable building block that encapsulates its own state and behavior while being part of a larger, composable UI hierarchy.

The implementation utilizes:

- **TelescopeJS** for state streams and updates.
- **React** for rendering components.

---

### Key Interfaces and Types

#### `TelescopedProps<T>`

```typescript
export interface TelescopedProps<T> {
  readonly state: T;
  readonly telescope: Telescope<T>;
}
```

- Represents the props passed to a component.
- **`state`**: The current state of type `T` managed by the `telescope`.
- **`telescope`**: A `Telescope<T>` instance, providing:
  - A stream of state changes.
  - A method to update the state, similar to `setState` in React.

#### `TelescopeComponent<T>`

```typescript
export type TelescopeComponent<T> = (
  props: TelescopedProps<T>,
) => React.ReactElement;
```

- A type alias for React functional components using `TelescopedProps<T>`.
- Ensures components conform to the pattern of receiving state and telescope as props.

#### `ViewModelHook<T, V>`

```typescript
export type ViewModelHook<T, V> = (props: TelescopedProps<T>) => V;
```

- A hook-like function for transforming the component’s state (`T`) into a **view model** (`V`).
- Encapsulates state-derived logic, simplifying rendering logic in components.

---

### Fractal Component Creation

#### `FractalComponentBuilder`

```typescript
export type FractalComponentBuilder = <TState, TViewModel>(
  buildViewModelHook: UseViewModelHook<TState, TViewModel>,
  toVirtualElement: (viewModel: TViewModel) => React.JSX.Element,
) => (props: TelescopedProps<TState>) => React.JSX.Element;
```

- A higher-order function type for building fractal components.
- Takes two arguments:
  1. **`buildViewModelHook`**: A hook to transform state (`TState`) into a view model (`TViewModel`).
  2. **`toVirtualElement`**: A function that maps the view model (`TViewModel`) to a React virtual DOM element (`JSX.Element`).
- Returns a fractal component function that:
  - Accepts `TelescopedProps<TState>` as input.
  - Uses the `buildViewModelHook` and `toVirtualElement` to render the component.

---

### `buildFractalComponent`

```typescript
export const buildFractalComponent: FractalComponentBuilder =
  <TState, TViewModel>(
    buildViewModelHook: UseViewModelHook<TState, TViewModel>,
    toVirtualElement: (viewModel: TViewModel) => React.JSX.Element,
  ) =>
  (props: TelescopedProps<TState>) =>
    toVirtualElement(buildViewModelHook(props));
```

- **Purpose**:

  - A concrete implementation of the `FractalComponentBuilder`.
  - Automates the creation of fractal components by wiring state transformations (`buildViewModelHook`) and rendering logic (`toVirtualElement`).

- **How It Works**:
  1. Takes a `buildViewModelHook` and `toVirtualElement` as input.
  2. Returns a new React component that:
     - Applies the `buildViewModelHook` to its props to derive a view model.
     - Passes the view model to `toVirtualElement` to generate the virtual DOM.

---

### Benefits

- **Modular Design**: Fractal components isolate state transformations and rendering logic.
- **Scalability**: The pattern promotes reusability by allowing hierarchical and composable components.
- **Flexibility**: `buildViewModelHook` provides a clean way to define state transformations, making it easier to adapt to changing requirements.
