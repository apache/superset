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
 * Imperative domain API for the dashboard layout client state — for use outside
 * render (event handlers, effects, non-React modules). Components import these
 * from `src/dashboard/stores` instead of calling `useDashboardLayoutStore`
 * directly. Layout writes delegate to the store's own actions (preserving
 * middleware); undo/redo operate on the zundo `temporal` store.
 */
import type { DashboardLayout } from 'src/dashboard/types';
import { useDashboardLayoutStore } from './useDashboardLayoutStore';

// --- Layout writes ---

export const updateComponents = (nextComponents: DashboardLayout): void =>
  useDashboardLayoutStore.getState().updateComponents(nextComponents);

export const updateDashboardTitle = (text: string): void =>
  useDashboardLayoutStore.getState().updateDashboardTitle(text);

export const deleteTopLevelTabs = (): void =>
  useDashboardLayoutStore.getState().deleteTopLevelTabs();

// --- Undo / redo (zundo temporal store) ---

export const undoLayout = (): void =>
  useDashboardLayoutStore.temporal.getState().undo();

export const redoLayout = (): void =>
  useDashboardLayoutStore.temporal.getState().redo();

export const clearLayoutHistory = (): void =>
  useDashboardLayoutStore.temporal.getState().clear();

/** Current undo-step count, read imperatively (e.g. inside an undo handler). */
export const getUndoLength = (): number =>
  useDashboardLayoutStore.temporal.getState().pastStates.length;
