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

describe("embedDashboard", () => {
  let mountPoint: HTMLElement;
  let mockSwitchboard: Switchboard;

  beforeEach(() => {
    mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);

    mockSwitchboard = {
      emit: vi.fn(),
      get: vi.fn(),
      start: vi.fn(),
      defineMethod: vi.fn(),
    } as any;

    // Constructor mocks must use `function`, since arrow functions cannot be
    // invoked with `new`.
    vi.mocked(Switchboard).mockImplementation(function () {
      return mockSwitchboard;
    } as any);

    // Mock MessageChannel API
    globalThis.MessageChannel = vi.fn(function (this: any) {
      this.port1 = {};
      this.port2 = {};
    }) as any;

    // Mock iframe load event and sandbox
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(tagName => {
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
});
