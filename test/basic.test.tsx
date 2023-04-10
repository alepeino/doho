import { fireEvent, render } from "@testing-library/react";
import { createElement, useState } from "react";
import { expectType } from "ts-expect";
import { Store } from "../src/store";

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

  it("can call writes with parameters", async () => {
    let ids = 0;

    class Item {
      public id = ++ids;
      constructor(public name: string) {}
      setName(newName: string) {
        this.name = newName;
      }
    }
    const state = new (class {
      public list: Item[] = [new Item("one"), new Item("two")];
      changeItemName(itemId: number, newName: string) {
        this.list.find((item) => item.id === itemId)?.setName(newName);
      }
    })();
    const store = new Store(state);

    const C = () => {
      const list = store.useRead((s) => s.list);
      const changeItemName = store.useWrite((s) => s.changeItemName);
      return (
        <ul>
          {list.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <button
                onClick={() => changeItemName(item.id, "updated")}
              ></button>
            </li>
          ))}
        </ul>
      );
    };
    const { findByText, getAllByRole } = render(<C />);

    fireEvent.click(getAllByRole("button")[1]);

    await findByText("one");
    await findByText("updated");
  });

  it("updates a mutable value", async () => {
    const state = new (class {
      public list = [1];
      addOne() {
        this.list.push(this.list.length + 1);
      }
    })();
    const store = new Store(state);

    const C = () => {
      const list = store.useRead((s) => s.list);
      const addOne = store.useWrite((s) => s.addOne);
      return (
        <>
          <ul>
            {list.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <button onClick={addOne}>+</button>
        </>
      );
    };
    const { findAllByRole, getByRole } = render(<C />);

    fireEvent.click(getByRole("button"));

    const items = await findAllByRole("listitem");

    expect(items).toHaveLength(2);
  });

  it("updates on mutable values cause nested components to rerender", async () => {
    let ids = 0;

    class Item {
      public id = ++ids;
      constructor(public name: string) {}
      setName(newName: string) {
        this.name = `${this.name} -> ${newName}`;
      }
    }
    const state = new (class {
      public list: Item[] = [new Item("one"), new Item("two")];
      changeItemName(itemId: number, newName: string) {
        this.list.find((item) => item.id === itemId)?.setName(newName);
      }
    })();
    const store = new Store(state);

    const ItemComp = ({ item }: { item: Item }) => <span>{item.name}</span>;
    const C = () => {
      const list = store.useRead((s) => s.list);
      const changeItemName = store.useWrite((s) => s.changeItemName);
      return (
        <ul>
          {list.map((item) => (
            <li key={item.id}>
              <ItemComp item={item} />
              <button
                onClick={() => changeItemName(item.id, "updated")}
              ></button>
            </li>
          ))}
        </ul>
      );
    };
    const { findByText, getAllByRole } = render(<C />);

    fireEvent.click(getAllByRole("button")[1]);

    await findByText("one");
    await findByText("two -> updated");
  });
});

describe("types", () => {
  const state = new (class {
    public x = 1;
    getX() {
      return this.x;
    }
    setX(newX: number) {
      this.x = newX;
    }
    inc() {
      this.x++;
    }
  })();
  const store = new Store(state);

  it("useRead types should match those of selected value", () => {
    render(
      createElement(() => {
        expectType<number>(store.useRead((s) => s.x));
        expectType<number>(store.useRead((s) => s.getX()));
        return null;
      })
    );
  });

  it("useWrite types should match those of selected value", () => {
    render(
      createElement(() => {
        expectType<() => void>(store.useWrite((s) => s.inc));
        expectType<() => number>(store.useWrite((s) => s.getX));
        expectType<(n: number) => void>(store.useWrite((s) => s.setX));
        return null;
      })
    );
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
