export interface CounterDisplayState {
  readonly count: number;
}

export interface CounterDisplayViewModel {
  readonly count: number;
  readonly increment: () => void;
}
