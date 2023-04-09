import { fireEvent, render } from "@testing-library/react";
import { useCallback, useEffect, useState } from "react";

type MethodsOf<T> = {
  [M in keyof T as T[M] extends (...args: unknown[]) => unknown
    ? M
    : never]: T[M] extends (...args: infer P) => infer R
    ? (...args: P) => R
    : never;
};

type Listener = () => void;

class Store<T> {
  private listeners: Listener[] = [];

  constructor(private value: T) {}

  useRead<R>(selector: (value: T) => R) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const getter = useCallback(() => selector(this.value), [selector]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [state, setState] = useState(getter);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => this.addListener(() => setState(getter)), [getter]);

    return state;
  }

  useWrite<M extends keyof MethodsOf<T>>(
    selector: (value: MethodsOf<T>) => MethodsOf<T>[M]
  ) {
    const selectedMethod: MethodsOf<T>[M] = selector(
      this.value as MethodsOf<T>
    );

    return (
      ...args: Parameters<MethodsOf<T>[M]>
    ): ReturnType<MethodsOf<T>[M]> => {
      const result = selectedMethod.call(this.value, args);
      this.emitChange();
      return result;
    };
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

describe("...", () => {
  it("reads a primitive value", async () => {
    const state = new (class {
      public x = 1;
    })();
    const store = new Store(state);
    const C = () => {
      const x = store.useRead((s) => s.x);
      return <span>x: {x}</span>;
    };
    const { findByText } = render(<C />);

    await findByText("x: 1");
  });

  it("updates a primitive value", async () => {
    const state = new (class {
      public x = 1;
      inc() {
        this.x++;
      }
    })();
    const store = new Store(state);

    const C = () => {
      const x = store.useRead((s) => s.x);
      const inc = store.useWrite((s) => s.inc);
      return (
        <div>
          <span>x: {x}</span>
          <button onClick={inc}>+</button>
        </div>
      );
    };
    const { findByText, getByRole } = render(<C />);

    fireEvent.click(getByRole("button"));

    expect(state.x).toEqual(2);
    await findByText("x: 2");
  });

  it("cleans up after unmount", async () => {
    const state = new (class {
      public x = 1;
      inc() {
        this.x++;
      }
    })();
    const store = new Store(state);

    const C = () => {
      const x = store.useRead((s) => s.x);
      const inc = store.useWrite((s) => s.inc);
      return (
        <div>
          <span>x: {x}</span>
          <button onClick={inc}>+</button>
        </div>
      );
    };
    const { getByRole, unmount } = render(<C />);

    fireEvent.click(getByRole("button"));

    unmount();

    expect(store["listeners"]).toHaveLength(0);
  });
});

describe("rerender control", () => {
  it("only re-renders if selected state has changed", async () => {
    const state = new (class {
      public x = 1;
      inc() {
        this.x++;
      }
    })();
    const store = new Store(state);

    let counterRenderCount = 0;
    let controlRenderCount = 0;

    const Counter = () => {
      const x = store.useRead((s) => s.x);
      counterRenderCount++;
      return <span>x: {x}</span>;
    };
    const Control = () => {
      const inc = store.useWrite((s) => s.inc);
      controlRenderCount++;
      return <button onClick={inc}>+</button>;
    };

    const { getByRole } = render(
      <>
        <Counter />
        <Control />
      </>
    );

    fireEvent.click(getByRole("button"));

    expect(counterRenderCount).toEqual(2);
    expect(controlRenderCount).toEqual(1);
  });
});

describe("selectors control", () => {
  it("should only call the selector when necessary", async () => {
    const state = new (class {
      public x = 1;
    })();
    const store = new Store(state);
    let selectorCallsCount = 0;
    let renderCount = 0;

    const C = () => {
      const x = store.useRead((s) => {
        selectorCallsCount++;
        return s.x;
      });
      const [localState, setLocalState] = useState(1);
      renderCount++;
      return (
        <>
          <span>n: {localState}</span>
          <button onClick={() => setLocalState((n) => n + 1)}></button>
          <span>x: {x}</span>
        </>
      );
    };

    const { getByRole } = render(<C />);
    fireEvent.click(getByRole("button"));

    expect(renderCount).toEqual(2);
    expect(selectorCallsCount).toEqual(1);
  });
});