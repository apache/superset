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
 * Module-scoped registry of in-flight stream AbortControllers.
 *
 * Lets the master Disposable abort any running stream even when the panel
 * is unmounted by a route change or by re-activation of the extension.
 */

const active = new Set<AbortController>();

export const registerActiveController = (c: AbortController): void => {
  active.add(c);
};

export const unregisterActiveController = (c: AbortController): void => {
  active.delete(c);
};

export const abortAllActiveControllers = (): void => {
  active.forEach(c => {
    try {
      c.abort();
    } catch {
      // ignore — abort() should not throw, but stay defensive.
    }
  });
  active.clear();
};
