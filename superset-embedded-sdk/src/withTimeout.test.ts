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

import { withTimeout } from "./withTimeout";

test("resolves with the value when the promise settles in time", async () => {
  await expect(withTimeout(Promise.resolve("ok"), 1000, "fetch")).resolves.toBe(
    "ok"
  );
});

test("rejects when the promise does not settle within the timeout", async () => {
  const never = new Promise<string>(() => {});
  await expect(withTimeout(never, 10, "fetch")).rejects.toThrow(
    /fetch did not resolve within 10ms/
  );
});

test("passes the promise through unchanged when the timeout is disabled", async () => {
  await expect(withTimeout(Promise.resolve("ok"), 0, "fetch")).resolves.toBe(
    "ok"
  );
});
