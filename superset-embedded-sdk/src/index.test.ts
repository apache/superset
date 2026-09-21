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
import { embedDashboard } from "./index";

vi.mock("@superset-ui/switchboard");

function makeFakeJWT(claims: any) {
  // not a valid jwt, but close enough for this code
  const tokenifiedClaims = Buffer.from(JSON.stringify(claims)).toString(
    "base64",
  );
  return `abc.${tokenifiedClaims}.xyz`;
}

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

  beforeEach(() => {
    mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);

    mockSwitchboard = makeMockSwitchboard();
    switchboards = [];

    // Constructor mocks must use `function`, since arrow functions cannot be
    // invoked with `new`.
    vi.mocked(Switchboard).mockImplementation(function () {
      const switchboard =
        switchboards.length === 0 ? mockSwitchboard : makeMockSwitchboard();
      switchboards.push(switchboard);
      return switchboard;
    } as any);

    // Mock MessageChannel API
    globalThis.MessageChannel = vi.fn(function (this: any) {
      this.port1 = {};
      this.port2 = {};
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
  describe("reauthentication after a navigation internal to the dashboard", () => {
    const fakeToken = () => makeFakeJWT({ exp: Date.now() / 1000 + 300 });

    // A link internal to the dashboard (side menu, tab, drill-down) navigates
    // the iframe: same element, brand new document, which knows nothing of the
    // channel the previous one was given.
    function reload() {
      mountPoint.querySelector("iframe")!.dispatchEvent(new Event("load"));
    }

    test("hands the reloaded document a new port and a fresh guest token", async () => {
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

    test("replays the host's methods on the new port", async () => {
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

    test("ignores a load that arrives after unmount", async () => {
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
  });
});
