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
 * Reactive domain hooks for native filters client state. Read through these
 * (imported from `src/dashboard/stores`) instead of the Zustand store directly;
 * imperative reads/writes live in `./actions`.
 */
import type { FilterEntry } from './useNativeFiltersStore';
import { useNativeFiltersStore } from './useNativeFiltersStore';

export const useFilterEntries = (): Record<string, FilterEntry> =>
  useNativeFiltersStore(s => s.filters);

export const useFocusedFilterId = (): string | undefined =>
  useNativeFiltersStore(s => s.focusedFilterId);

export const useHoveredFilterId = (): string | undefined =>
  useNativeFiltersStore(s => s.hoveredFilterId);
