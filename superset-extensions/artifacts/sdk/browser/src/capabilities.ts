/*
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
 * @fileoverview Capabilities: the named rights an artifact declares in its
 * manifest and a host grants, as its policy allows, for each context. Mirrors
 * `superset_artifacts_sdk.capabilities`; the Python SDK's
 * `test_artifact_typescript_sync.py` checks that the two agree.
 */

export const Capability = {
  /**
   * Receive the results of the manifest's bindings and the filters that
   * reach the artifact, and ask for a binding again: with new parameter
   * values, or fresh from the warehouse.
   */
  DATA: 'data',
  /** Set cross-filters, on declared events, that the other widgets follow. */
  CROSS_FILTER: 'cross_filter',
  /** Receive the canvas theme: its tokens, and light or dark mode. */
  THEME: 'theme',
  /** Compile and run WebAssembly; still no network. */
  COMPUTE_WASM: 'compute.wasm',
  /** Start workers from blob: URLs; still no network. */
  COMPUTE_WORKERS: 'compute.workers',
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];

/** Every capability, in declaration order. */
export const CAPABILITIES: readonly Capability[] = Object.freeze(
  Object.values(Capability),
);

/** Whether `value` names a capability this SDK knows. */
export function isCapability(value: unknown): value is Capability {
  return (
    typeof value === 'string' &&
    (CAPABILITIES as readonly string[]).includes(value)
  );
}
