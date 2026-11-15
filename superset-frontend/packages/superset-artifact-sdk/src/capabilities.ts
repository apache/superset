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
 * manifest and a host grants for each context. Mirrors
 * `superset_core.artifacts.capabilities`; superset-core's
 * `test_artifact_typescript_sync.py` checks that the two agree.
 */

export const Capability = {
  /**
   * Receive the results of the manifest's bindings and the filters that
   * reach the artifact, and rerun a binding with new parameter values.
   */
  DATA: 'data',
  /** Set cross-filters that the canvas's other widgets follow. */
  CROSS_FILTER: 'cross_filter',
  /** Emit the declared selection, highlight and drill events. */
  EVENTS: 'events',
  /** Ask the host to run the bindings again. */
  REFRESH: 'refresh',
  /** Receive the canvas theme: its tokens, and light or dark mode. */
  THEME: 'theme',
} as const;

// TODO: decide on a compute capability for WebAssembly, workers and eval.
// Until then it is deliberately not listed.

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
