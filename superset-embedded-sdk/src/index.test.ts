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

import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { Switchboard } from "@superset-ui/switchboard";
import { embedDashboard, PortClosedError } from "./index";
import { DEFAULT_TOKEN_REFRESH_RETRY_MS } from "./guestTokenRefresh";

// Mock Switchboard; PortClosedError is imported from ./index so it's safe
vi.mock("@superset-ui/switchboard", () => ({
  Switchboard: vi.fn(),
}));

function makeFakeJWT(claims: any) {
  const tokenifiedClaims = Buffer.from(JSON.stringify(claims)).toString(
    "base64",
  );
  return `abc.${tokenifiedClaims}.xyz`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const neverAnswered = () => new Promise(() => {});

function makeMockSwitchboard(): Switchboard {
  return {
    emit: vi.fn(),
    get: vi.fn().mockResolvedValue(undefined), // Return a Promise so `track` doesn't crash
    start: vi.fn(),
    stop: vi.fn(),
    defineMethod: vi.fn(),
  } as any;
}

describe("embedDashboard", () => {
  let mountPoint: HTMLElement;
  let mockSwitchboard: Switchboard;
  let switchboards: Switchboard[];
  let ports: { close: ReturnType<typeof vi.fn> }[];
  let getImpls: Array<(() => any) | undefined>;

  beforeEach(() => {
    mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);

    mockSwitchboard = makeMockSwitchboard();
    switchboards = [];
    ports = [];
    getImpls = [];

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

    globalThis.MessageChannel = vi.fn(function (this: any) {
      this.port1 = { close: vi.fn() };
      this.port2 = {};
      ports.push(this.port1);
    }) as any;

    vi.spyOn(globalThis, "setTimeout");

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "iframe") {
        (element as any).sandbox = {
          add: vi.fn(),
        };
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

  const fakeToken = () => makeFakeJWT({ exp: Date.now() / 1000 + 300 });

  function reload() {
    mountPoint.querySelector("iframe")!.dispatchEvent(new Event("load"));
  }

  test("setDataMask sends dataMask to iframe", async () => {
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
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
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
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
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
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
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());
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
    const mockFetchGuestToken = vi.fn().mockResolvedValue(fakeToken());

    const dashboard = await embedDashboard({
      id: "test-id",
      supersetDomain: "https://superset.example.com",
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    // Mock rejection HANYA untuk "setDataMask" SETELAH dashboard berhasil di-inisialisasi
    vi.mocked(mockSwitchboard.get).mockImplementation((method: string) => {
      if (method === "setDataMask") {
        return Promise.reject(new Error('Method "setDataMask" is not defined'));
      }
      return Promise.resolve(undefined);
    });

    await expect(dashboard.setDataMask({})).rejects.toThrow(
      'Method "setDataMask" is not defined',
    );
  });

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
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("guestToken", {
        guestToken: expect.any(String),
      }),
    );
    expect(mockFetchGuestToken).toHaveBeenCalledTimes(2);

    const constructions = vi.mocked(Switchboard).mock.calls;
    expect(constructions).toHaveLength(2);
    expect((constructions[1][0] as any).port).not.toBe(
      (constructions[0][0] as any).port,
    );
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
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("setThemeMode", {
        mode: "dark",
      }),
    );
    expect(switchboards[1].emit).toHaveBeenCalledWith("setThemeConfig", {
      themeConfig: { token: { colorPrimary: "#ff0000" } },
    });
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
    await expect(dashboard.getScrollSize()).rejects.toBeInstanceOf(
      PortClosedError,
    );
  });

  test("reload does not mint a token for a page that is not the embedded one", async () => {
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

    await vi.waitFor(() => expect(switchboards).toHaveLength(1));
    reload();
    await vi.waitFor(() =>
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(2),
    );

    initialToken.resolve(fakeToken());
    const dashboard = await embedding;

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
    await vi.waitFor(() =>
      expect(switchboards[1].emit).toHaveBeenCalledWith("guestToken", {
        guestToken: expect.any(String),
      }),
    );

    initialToken.reject(new Error("host down"));
    const dashboard = await embedding;

    expect(mountPoint.querySelector("iframe")).not.toBeNull();
    expect(ports[1].close).not.toHaveBeenCalled();
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

    await vi.waitFor(() => expect(switchboards).toHaveLength(1));
    initialToken.reject(new Error("host down"));

    await expect(embedding).rejects.toThrow("host down");
    expect(mountPoint.querySelector("iframe")).toBeNull();
    expect(ports[0].close).toHaveBeenCalled();
  });

  describe("embedDashboard happy path", () => {
    it("successfully embeds dashboard with valid token", async () => {
      const mockFetch = vi.fn().mockResolvedValue("valid-jwt-token");

      const result = await embedDashboard({
        id: "test-dashboard",
        supersetDomain: "http://localhost:8200",
        mountPoint,
        fetchGuestToken: mockFetch,
      });

      expect(result).toBeDefined();
      expect(typeof result.getScrollSize).toBe("function");
      expect(typeof result.unmount).toBe("function");
    });
  });

  describe("embedDashboard security", () => {
    it("rejects if fetchGuestToken throws an error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Invalid token"));
      
      await expect(
        embedDashboard({
          id: "test-dashboard",
          supersetDomain: "http://localhost:8200",
          mountPoint,
          fetchGuestToken: mockFetch,
        })
      ).rejects.toThrow("Invalid token");
    });
  });

  describe("embedDashboard edge cases", () => {
    test("a refresh whose fetch fails is retried after the retry delay", async () => {
      vi.useFakeTimers();
      const mockFetchGuestToken = vi
        .fn()
        .mockResolvedValueOnce(fakeToken())
        .mockRejectedValueOnce(new Error("token expired"))
        .mockImplementationOnce(() => Promise.resolve(fakeToken()));
      const embedding = embedDashboard({
        id: "test-id",
        supersetDomain: "https://superset.example.com",
        mountPoint,
        fetchGuestToken: mockFetchGuestToken,
      });
      await vi.advanceTimersByTimeAsync(0);
      const dashboard = await embedding;
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(300_000);
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(2);
      expect(mockSwitchboard.emit).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(DEFAULT_TOKEN_REFRESH_RETRY_MS);
      expect(mockFetchGuestToken).toHaveBeenCalledTimes(3);
      expect(mockSwitchboard.emit).toHaveBeenCalledTimes(2);

      dashboard.unmount();
      vi.useRealTimers();
    });

    it("handles unmount during token refresh", async () => {
      const mockFetch = vi.fn().mockResolvedValue("token-1");

      const result = await embedDashboard({
        id: "test-dashboard",
        supersetDomain: "http://localhost:8200",
        mountPoint,
        fetchGuestToken: mockFetch,
      });

      result.unmount();

      expect(mountPoint.querySelector("iframe")).toBeNull();
      expect(ports[0].close).toHaveBeenCalled();
    });
  });
});