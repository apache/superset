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

// While held, the dashboard keeps the filter key from the opened link in the
// URL instead of replacing it with a key for the fallback (default) filters.
// The hold ends when the viewer changes a filter. The opened link's key stays
// protected after that: publishes never update it, they create a new key, so
// the saved state behind the link is never overwritten even when two publishes
// overlap and the URL still carries the original key.
let held = false;
let protectedKey: string | null = null;
const releaseListeners = new Set<() => void>();

export const holdFilterKeyPublish = (key: string) => {
  held = true;
  protectedKey = key;
};

/** Ends an active hold because the viewer changed a filter. */
export const releaseFilterKeyPublish = () => {
  if (!held) return;
  held = false;
  releaseListeners.forEach(listener => listener());
};

/** Clears the hold and key protection, e.g. when another dashboard loads. */
export const resetFilterKeyHold = () => {
  held = false;
  protectedKey = null;
};

/** Calls `listener` whenever an active hold is released. Returns unsubscribe. */
export const subscribeFilterKeyPublishRelease = (listener: () => void) => {
  releaseListeners.add(listener);
  return () => {
    releaseListeners.delete(listener);
  };
};

export const isFilterKeyPublishHeld = () => held;

/** True for the key of the opened link whose saved state must not change. */
export const isProtectedFilterKey = (key: string | null | undefined) =>
  key != null && key === protectedKey;
