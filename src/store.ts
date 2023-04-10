import { useCallback, useEffect, useState } from "react";

type MethodsOf<T> = {
  [M in keyof T as T[M] extends (...args: unknown[]) => unknown
    ? M
    : never]: T[M] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never;
};

type Listener = () => void;

export class Store<T> {
  private listeners: Listener[] = [];

  constructor(private value: T) {}

  useRead<R>(selector: (value: T) => R) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const getter = useCallback(
      () => ({ value: selector(this.value) }),
      [selector]
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [state, setState] = useState(getter);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => this.addListener(() => setState(getter)), [getter]);

    return state.value;
  }

  useWrite<R extends MethodsOf<T>[keyof MethodsOf<T>]>(
    selector: (value: MethodsOf<T>) => R
  ): R {
    const selectedMethod = selector(this.value as MethodsOf<T>);
    return ((...args) => {
      const result = selectedMethod.call(this.value, ...args);
      this.emitChange();
      return result;
    }) as typeof selectedMethod;
  }

  private emitChange() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private addListener(listener) {
    this.listeners.push(listener);
    return () => {
      this.removeListener(listener);
    };
  }

  private removeListener(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
}
