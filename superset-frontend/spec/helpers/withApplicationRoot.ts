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

/**
 * Run `callback` with `getBootstrapData().common.application_root` set to
 * `applicationRoot`. Resets modules so any imports inside the callback see
 * the configured value, then restores the prior DOM and module cache on exit.
 * Pass `''` to simulate the default root-of-domain deployment.
 */
export async function withApplicationRoot<T>(
  applicationRoot: string,
  callback: () => Promise<T> | T,
): Promise<T> {
  const previousBody = document.body.innerHTML;

  try {
    const bootstrapData = { common: { application_root: applicationRoot } };
    document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(bootstrapData)}'></div>`;
    jest.resetModules();
    await import('src/utils/getBootstrapData');
    return await callback();
  } finally {
    document.body.innerHTML = previousBody;
    jest.resetModules();
  }
}

/** Run `body` once per scenario, each under a different application root. */
export async function applicationRootScenarios<S extends { root: string }>(
  scenarios: S[],
  body: (scenario: S) => Promise<void> | void,
): Promise<void> {
  for (const scenario of scenarios) {
    // eslint-disable-next-line no-await-in-loop -- intentional: scenarios share document state.
    await withApplicationRoot(scenario.root, () => body(scenario));
  }
}
