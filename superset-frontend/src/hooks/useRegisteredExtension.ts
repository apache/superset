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

import { useCallback, useSyncExternalStore } from 'react';
import { getExtensionsRegistry } from '@superset-ui/core';
import type { Extensions } from '@superset-ui/core';

const registry = getExtensionsRegistry();

/**
 * Reads a slot from the extensions registry, and re-reads it on registration.
 *
 * A plain `registry.get(...)` during render is a one-shot read. That was fine
 * while everything registered at application startup, before anything
 * rendered. Extensions are fetched and evaluated after the application has
 * mounted, so a component that reads the registry while rendering reads an
 * empty one and never looks again: the registration quietly has no effect.
 *
 * @param key The registry slot to read, e.g. `'root.context.provider'`.
 * @returns Whatever is registered at that slot, or undefined.
 *
 * @example
 * ```typescript
 * const Provider = useRegisteredExtension('root.context.provider');
 * ```
 */
export default function useRegisteredExtension<K extends keyof Extensions>(
  key: K,
): Extensions[K] {
  const getSnapshot = useCallback(() => registry.get(key), [key]);
  return useSyncExternalStore(
    // `subscribe` returns its own unsubscribe, which is exactly the contract
    // `useSyncExternalStore` wants.
    listener => registry.subscribe(listener),
    getSnapshot,
    getSnapshot,
  );
}
