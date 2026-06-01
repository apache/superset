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

import {
  validateEmbeddedDashboardId,
  validateSupersetDomain,
  findUnsafeSandboxExtras,
} from "./index";

describe("validateEmbeddedDashboardId", () => {
  it("accepts a canonical uuid", () => {
    expect(() =>
      validateEmbeddedDashboardId("f4787a4f-2541-4f8a-9b5e-1e2d3c4b5a6f")
    ).not.toThrow();
  });

  it("accepts a simple hexadecimal id", () => {
    expect(() => validateEmbeddedDashboardId("abc123")).not.toThrow();
  });

  it.each([
    ["../../evil"],
    ["a/b"],
    ["x?foo=bar"],
    ["x#frag"],
    ["a@b.com"],
    ["foo bar"],
    ["http://evil.com"],
    [""],
    ["%2e%2e"],
  ])("rejects an id with an unexpected format: %p", (id) => {
    expect(() => validateEmbeddedDashboardId(id)).toThrow();
  });
});

describe("validateSupersetDomain", () => {
  it.each([
    ["https://superset.example.com"],
    ["http://localhost:8088"],
    // sub-path deployments are valid; the origin is what matters downstream
    ["https://example.com/superset"],
  ])("accepts a valid absolute URL: %p", (domain) => {
    expect(() => validateSupersetDomain(domain)).not.toThrow();
  });

  it.each([
    ["superset.example.com"], // missing protocol
    ["not a url"],
    [""],
    ["/relative/path"],
  ])("rejects a malformed domain: %p", (domain) => {
    expect(() => validateSupersetDomain(domain)).toThrow(
      "Invalid supersetDomain format"
    );
  });
});

describe("findUnsafeSandboxExtras", () => {
  it("returns the tokens that relax iframe isolation", () => {
    expect(
      findUnsafeSandboxExtras([
        "allow-forms",
        "allow-top-navigation",
        "allow-popups",
        "allow-top-navigation-by-user-activation",
      ])
    ).toEqual(["allow-top-navigation", "allow-top-navigation-by-user-activation"]);
  });

  it("returns an empty array when all tokens are safe", () => {
    expect(
      findUnsafeSandboxExtras(["allow-forms", "allow-popups", "allow-downloads"])
    ).toEqual([]);
  });
});
