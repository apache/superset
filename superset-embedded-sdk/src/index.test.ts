/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Switchboard } from "@superset-ui/switchboard";
import { embedDashboard, PortClosedError } from "./index";

vi.mock("@superset-ui/switchboard");

function makeFakeJWT(claims: any) {
  // not a valid jwt, but close enough for this code
  const tokenifiedClaims = Buffer.from(JSON.stringify(claims)).toString(
    "base64",
  );
  return `abc.${tokenifiedClaims}.xyz`;
}

// Resolves only when the test says so, for the interleavings where a token
// fetch has to still be in flight while something else happens.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// A `get` that is never answered, like one sent to a document that is gone.
const neverAnswered = () => new Promise(() => {});

function makeMockSwitchboard(): Switchboard {
  return {
    emit: vi.fn(),
    get: vi.fn(),
    start: vi.fn(),
    defineMethod: vi.fn(),
  } as any;
}

describe("embedDashboard", () => {
  let mountPoint: HTMLElement;
  let mockSwitchboard: Switchboard;
  // One entry per port the SDK opens: a reload adds another.
  let switchboards: Switchboard[];
  // The `port1` of each channel the SDK opens, in the same order.
  let ports: { close: ReturnType<typeof vi.fn> }[];
  // `get` implementations handed to the switchboards the SDK is about to
  // build, in order. A hole, or running off the end, means the default mock.
  let getImpls: Array<(() => any) | undefined>;

  beforeEach(() => {
    mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);

    mockSwitchboard = makeMockSwitchboard();
    switchboards = [];
    ports = [];
    getImpls = [];

    // Constructor mocks must use `function`, since arrow functions cannot be
    // invoked with `new`.
    vi.mocked(Switchboard).mockImplementation(function () {
      const switchboard =
        switchboards.length === 0 ? mockSwitchboard : makeMockSwitchboard();
      const getImpl = getImpls.shift();
      if (getImpl) {
        vi.mocked(switchboard.get).mockImplementation(getImpl as any);
      }
      switchboards.push(switchboard);
      return switchboard;
    } as any);

    // Mock MessageChannel API. Each port gets a `close` spy, so a test can see
    // the SDK let go of a channel whose document is gone.
    globalThis.MessageChannel = vi.fn(function (this: any) {
      this.port1 = { close: vi.fn() };
      this.port2 = {};
      ports.push(this.port1);
    }) as any;

    vi.spyOn(globalThis, "setTimeout");

    // Mock iframe load event and sandbox
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "iframe") {
        // Mock sandbox DOMTokenList
        (element as any).sandbox = {
          add: vi.fn(),
        };
        // Mock contentWindow for postMessage
        Object.defineProperty(element, "contentWindow", {
          writable: true,
          value: {
            postMessage: vi.fn(),
          },
        });
        setTimeout(() => {
          element.dispatchEvent(new Event("load"));
        }, 0);
      }
      return element;
    });
  });

  afterEach(() => {
    document.body.removeChild(mountPoint);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("setDataMask sends dataMask to iframe", async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken);
    const testDataMask = {
      "NATIVE_FILTER-1": {
        filterState: {
          value: ["value1", "value2"],
        },
      },
    };

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(testDataMask);

    expect(mockSwitchboard.get).toHaveBeenCalledWith("setDataMask", {
      dataMask: testDataMask,
    });
  });

  test("setDataMask sends empty dataMask", async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken);
    const emptyDataMask = {};

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(emptyDataMask);

    expect(mockSwitchboard.get).toHaveBeenCalledWith("setDataMask", {
      dataMask: emptyDataMask,
    });
  });

  test("setDataMask drops the change-trigger flags observeDataMask adds", async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken);
    const observedMask = {
      "NATIVE_FILTER-1": {
        filterState: {
          value: ["CA"],
        },
      },
      crossFiltersChanged: false,
      nativeFiltersChanged: true,
    };

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(observedMask);

    expect(mockSwitchboard.get).toHaveBeenCalledWith("setDataMask", {
      dataMask: {
        "NATIVE_FILTER-1": observedMask["NATIVE_FILTER-1"],
      },
    });
  });

  test("setDataMask sends complex dataMask with multiple filters", async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken);
    const complexDataMask = {
      "NATIVE_FILTER-1": {
        filterState: {
          value: ["CA", "NY"],
        },
      },
      "NATIVE_FILTER-2": {
        filterState: {
          value: [2023, 2024],
        },
      },
    };

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(complexDataMask);

    expect(mockSwitchboard.get).toHaveBeenCalledWith("setDataMask", {
      dataMask: complexDataMask,
    });
  });

  test("setDataMask rejects when the embedded page does not support it", async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken);
    vi.mocked(mockSwitchboard.get).mockRejectedValue(
      new Error('Method "setDataMask" is not defined'),
    );

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    await expect(dashboard.setDataMask({})).rejects.toThrow(
      'Method "setDataMask" is not defined',
    );
  });
  const fakeToken = () => makeFakeJWT({ exp: Date.now() / 1000 + 300 });

  // A link internal to the dashboard (side menu, tab, drill-down) navigates
  // the iframe: same element, brand new document, which knows nothing of the
  // channel the previous one was given.
  function reload() {
    mountPoint.querySelector("iframe")!.dispatchEvent(new Event("load"));
  }

  test("reload hands the reloaded document a new port and a fresh guest token", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });
    expect(mockFetchGuestToken).toHaveBeenCalledTimes(1);

    reload();
    // The token is fetched again rather than replayed from memory: the one in
    // hand may be seconds from expiring, and the new page would take it
    // straight into a 401.
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("guestToken", {
        guestToken: expect.any(String),
      }),
    );
    expect(mockFetchGuestToken).toHaveBeenCalledTimes(2);

    // A channel of its own, not the one the first document holds.
    const constructions = vi.mocked(Switchboard).mock.calls;
    expect(constructions).toHaveLength(2);
    expect((constructions[1][0] as any).port).not.toBe(
      (constructions[0][0] as any).port,
    );
    // Nothing is sent to the document that is gone.
    expect(switchboards[0].emit).toHaveBeenCalledTimes(1);

    dashboard.unmount();
  });

  test("reload replays the host's methods on the new port", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const observer = vi.fn();
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
      resolvePermalinkUrl: ({ key }) => `https://host.example.com/p/${key}`,
    });
    dashboard.observeDataMask(observer);

    reload();
    await vi.waitFor(() =>
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(2),
    );

    // The new document has never heard of either method.
    const defined = vi
      .mocked(switchboards[1].defineMethod)
      .mock.calls.map(([name]) => name);
    expect(defined).toContain("resolvePermalinkUrl");
    expect(defined).toContain("observeDataMask");

    dashboard.unmount();
  });

  test("reload ignores a load that arrives after unmount", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });
    const iframe = mountPoint.querySelector("iframe")!;

    dashboard.unmount();
    iframe.dispatchEvent(new Event("load"));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(vi.mocked(Switchboard).mock.calls).toHaveLength(1);
    expect(mockFetchGuestToken).toHaveBeenCalledTimes(1);
  });

  test("reload re-applies the theme the host set, after the new token", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });
    dashboard.setThemeConfig({ token: { colorPrimary: "#ff0000" } });
    dashboard.setThemeMode("dark");

    reload();
    // The new document is a new realm: it knows nothing of the theme the
    // host applied to the one before it, so the SDK pushes it again.
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("setThemeMode", {
        mode: "dark",
      }),
    );
    expect(switchboards[1].emit).toHaveBeenCalledWith("setThemeConfig", {
      themeConfig: { token: { colorPrimary: "#ff0000" } },
    });
    // The token comes first, in the order a host would do it on a first load.
    const emitted = vi
      .mocked(switchboards[1].emit)
      .mock.calls.map(([method]) => method);
    expect(emitted).toEqual(["guestToken", "setThemeConfig", "setThemeMode"]);
    expect(mockFetchGuestToken).toHaveBeenCalledTimes(2);

    dashboard.unmount();
  });

  test("reload rejects the calls left unanswered on the abandoned port", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    // The host asks the dashboard something, and the user clicks a link
    // before the answer comes back. That answer is never coming.
    vi.mocked(switchboards[0].get).mockImplementation(neverAnswered as any);
    const pending = dashboard.getActiveTabs();
    reload();

    await expect(pending).rejects.toBeInstanceOf(PortClosedError);
    expect(ports[0].close).toHaveBeenCalled();
    expect(ports[1].close).not.toHaveBeenCalled();

    dashboard.unmount();
  });

  test("unmount rejects the calls left unanswered, and closes the port", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    vi.mocked(switchboards[0].get).mockImplementation(neverAnswered as any);
    const pending = dashboard.getScrollSize();
    dashboard.unmount();

    await expect(pending).rejects.toBeInstanceOf(PortClosedError);
    expect(ports[0].close).toHaveBeenCalled();
    // And a call made afterwards fails instead of hanging.
    await expect(dashboard.getScrollSize()).rejects.toBeInstanceOf(
      PortClosedError,
    );
  });

  test("reload does not mint a token for a page that is not the embedded one", async () => {
    // A link in a Markdown chart can point anywhere. The document that
    // answers nothing on the channel is not an embedded Superset page.
    getImpls = [undefined, neverAnswered];
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    vi.useFakeTimers();
    reload();
    // Long enough for the handshake probe to give up.
    await vi.advanceTimersByTimeAsync(10_000);

    expect(mockFetchGuestToken).toHaveBeenCalledTimes(1);
    expect(switchboards[1].emit).not.toHaveBeenCalled();

    dashboard.unmount();
    vi.useRealTimers();
  });

  test("reload gives the new document the initial token when its own fetch fails", async () => {
    const initialToken = deferred<string>();
    const mockFetchGuestToken = vi
      .fn()
      .mockImplementationOnce(() => initialToken.promise)
      .mockImplementationOnce(() => Promise.reject(new Error("host down")));

    const embedding = embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    // The user navigates while the very first token is still in flight, and
    // the fetch that navigation triggers fails.
    await vi.waitFor(() => expect(switchboards).toHaveLength(1));
    reload();
    await vi.waitFor(() =>
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(2),
    );

    initialToken.resolve(fakeToken());
    const dashboard = await embedding;

    // That token is superseded but perfectly valid, and the document in
    // front of the user has none: hold on to it and the page stays blank
    // for a whole retry interval.
    expect(switchboards[1].emit).toHaveBeenCalledWith("guestToken", {
      guestToken: expect.any(String),
    });
    expect(switchboards[0].emit).not.toHaveBeenCalled();

    dashboard.unmount();
  });

  test("initial fetch failing after a reload leaves the recovered embed alone", async () => {
    const initialToken = deferred<string>();
    const mockFetchGuestToken = vi
      .fn()
      .mockImplementationOnce(() => initialToken.promise)
      .mockImplementationOnce(() => Promise.resolve(fakeToken()));

    const embedding = embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    await vi.waitFor(() => expect(switchboards).toHaveLength(1));
    reload();
    // The reload's own fetch succeeds: the document in front of the user has a
    // token and is rendering.
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("guestToken", {
        guestToken: expect.any(String),
      }),
    );

    // ...and only then does the initial fetch give up. Nobody is waiting for
    // it any more, so it must not take the working dashboard down with it.
    initialToken.reject(new Error("host down"));
    const dashboard = await embedding;

    expect(mountPoint.querySelector("iframe")).not.toBeNull();
    expect(ports[1].close).not.toHaveBeenCalled();
    // The reload's cycle still owns the refresh, and there is exactly one.
    const refreshArms = vi
      .mocked(globalThis.setTimeout)
      .mock.calls.filter(([, delay]) => (delay ?? 0) > 200_000);
    expect(refreshArms).toHaveLength(1);

    dashboard.unmount();
  });

  test("initial fetch failing with no reload tears the iframe down", async () => {
    const initialToken = deferred<string>();
    const mockFetchGuestToken = vi
      .fn()
      .mockImplementation(() => initialToken.promise);

    const embedding = embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    // Let the first load open its channel, so the teardown has something to
    // let go of, and only then fail the fetch.
    await vi.waitFor(() => expect(switchboards).toHaveLength(1));
    initialToken.reject(new Error("host down"));

    await expect(embedding).rejects.toThrow("host down");
    expect(mountPoint.querySelector("iframe")).toBeNull();
    expect(ports[0].close).toHaveBeenCalled();
  });
});
