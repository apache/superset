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
import { useLayoutEffect, useRef, useMemo } from 'react';

/**
 * Execute a memoized callback only when mounted. Execute again when factory updated.
 * Returns undefined if not mounted yet.
 */
export default function useMountedMemo<T>(factory: () => T, deps?: unknown[]): T | undefined {
  const mounted = useRef<typeof factory>();
  useLayoutEffect(() => {
    mounted.current = factory;
  });
  return useMemo(() => {
    if (mounted.current) {
      return factory();
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted.current, mounted.current === factory, ...(deps || [])]);
}
