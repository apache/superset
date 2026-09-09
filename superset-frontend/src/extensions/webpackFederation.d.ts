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
 * Ambient types for webpack Module Federation runtime internals.
 *
 * `ModuleFederationPlugin` (`webpack/types.d.ts`) only types plugin
 * *configuration*; the runtime globals and container shape it emits
 * (`__webpack_init_sharing__`, `__webpack_share_scopes__`, and the
 * `{ init, get }` container interface assigned to `window[containerName]`)
 * are not part of webpack's public API and ship with no types of their own.
 * The shape below documents the "dynamic remote container" pattern from
 * https://webpack.js.org/concepts/module-federation/#dynamic-remote-containers,
 * which is the only part of this contract webpack's docs commit to.
 *
 * `src/extensions/ExtensionsLoader.ts` is the sole consumer. If a webpack
 * upgrade changes this runtime shape, this is the single place to update.
 */

/**
 * A single shared-module entry within a Module Federation share scope.
 */
interface WebpackSharedScopeModule {
  get: () => Promise<() => unknown>;
  loaded?: boolean;
  eager?: boolean;
}

/**
 * A share scope: shared package name -> resolved version -> module entry.
 */
type WebpackSharedScope = Record<
  string,
  Record<string, WebpackSharedScopeModule>
>;

/**
 * The runtime interface exposed by a Module Federation remote container,
 * assigned to `window[containerName]` once its remoteEntry script has loaded.
 */
interface WebpackFederationContainer {
  init(shareScope: WebpackSharedScope): Promise<void>;
  get(request: string): Promise<() => unknown>;
}

declare function __webpack_init_sharing__(scopeName: string): Promise<void>;
declare var __webpack_share_scopes__: Record<string, WebpackSharedScope>;
