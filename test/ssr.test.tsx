/** @jest-environment node */

import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { Store } from "../src/store";

describe("SSR", () => {
  it("can be server rendered", async () => {
    const isServer = typeof window === "undefined";
    const store = new Store({ env: isServer ? "server" : "client" });
    const C = () => {
      const x = store.useRead((s) => s.env);
      return <span>env: {x}</span>;
    };
    const html = renderToString(<C />);
    const dom = new JSDOM(html);
    const data = dom.window.document.querySelector("span");
    expect(data).toHaveTextContent("env: server");
  });
});
