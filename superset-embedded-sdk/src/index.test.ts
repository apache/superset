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

import { validateEmbeddedDashboardId } from "./index";

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
