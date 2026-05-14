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
 * Module-level subscribable store for transient per-component theme
 * previews. Used by `ThemeSelectorModal` to make a draft selection
 * visually applied without committing to Redux (which would mark the
 * dashboard dirty). `ComponentThemeProvider` subscribes via
 * `useSyncExternalStore` and prefers a present preview over the
 * resolved-from-Redux `themeId`.
 *
 * `null` means "explicitly clear the override during preview" — the
 * provider treats it the same way it treats a Redux `null`. Absence
 * (key not in the map) means "no preview active; use Redux".
 */

type PreviewValue = number | null;
type Listener = () => void;

const previewMap = new Map<string, PreviewValue>();
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach(l => l());
};

export const previewThemeStore = {
  /** Sets a transient preview for `layoutId`. Replaces any prior preview. */
  set(layoutId: string, themeId: PreviewValue): void {
    if (previewMap.get(layoutId) === themeId) return;
    previewMap.set(layoutId, themeId);
    emit();
  },

  /** Clears any preview for `layoutId`. No-op when none is active. */
  clear(layoutId: string): void {
    if (!previewMap.has(layoutId)) return;
    previewMap.delete(layoutId);
    emit();
  },

  /**
   * Returns the previewed value for `layoutId`, or `undefined` when no
   * preview is active. Used by `ComponentThemeProvider` via
   * `useSyncExternalStore`. Returning `undefined` (vs `null`) lets
   * callers distinguish "no preview" from "preview the cleared state".
   */
  get(layoutId: string): PreviewValue | undefined {
    return previewMap.has(layoutId) ? previewMap.get(layoutId) : undefined;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
