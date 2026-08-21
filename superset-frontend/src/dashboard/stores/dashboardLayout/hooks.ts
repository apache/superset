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
 * Reactive domain hooks for the dashboard layout client state. Components read
 * in render through these (imported from `src/dashboard/stores`) rather than
 * touching the Zustand store directly. Undo/redo history lives in the zundo
 * `temporal` store; its reactive lengths are exposed here, while the imperative
 * undo/redo/clear operations live in `./actions`.
 */
import { useStore } from 'zustand';
import type { DashboardLayout } from 'src/dashboard/types';
import { useDashboardLayoutStore } from './useDashboardLayoutStore';

/** The full dashboard layout tree. */
export const useDashboardLayout = (): DashboardLayout =>
  useDashboardLayoutStore(s => s.layout);

/** Number of undo steps available (zundo past states). */
export const useUndoLength = (): number =>
  useStore(useDashboardLayoutStore.temporal, s => s.pastStates.length);

/** Number of redo steps available (zundo future states). */
export const useRedoLength = (): number =>
  useStore(useDashboardLayoutStore.temporal, s => s.futureStates.length);
