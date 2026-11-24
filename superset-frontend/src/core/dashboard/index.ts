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
import { dashboard as dashboardApi } from '@apache-superset/core';
import { store } from 'src/views/store';
import { Disposable } from '../models';

/**
 * The host side of the `dashboard` namespace.
 *
 * Two of the three members read the store, so they answer for whatever
 * dashboard is on screen and need no registration. `save` cannot: the save
 * the host's own Save button performs is a callback built inside the
 * dashboard header, not a plain action this module could dispatch, so the
 * header hands it over while it is mounted. That is the same arrangement SQL
 * Lab uses for editor handles.
 */

/** The save the dashboard header is currently offering, if one is mounted. */
let saveHandle: (() => void) | undefined;

/**
 * Lets the dashboard header lend its save to the namespace.
 *
 * Called from the header while it is mounted in edit mode. Disposing the
 * registration withdraws the handle, but only if it is still the one that was
 * registered: the header re-registers whenever its callback identity changes,
 * and the effect cleaning up the previous registration runs after the new one
 * has been made.
 *
 * @param handle The header's own save.
 * @returns A Disposable that withdraws this handle.
 */
export const registerDashboardSaveHandle = (handle: () => void): Disposable => {
  saveHandle = handle;
  return new Disposable(() => {
    if (saveHandle === handle) {
      saveHandle = undefined;
    }
  });
};

const unsavedChanges = (): boolean =>
  !!store.getState().dashboardState?.hasUnsavedChanges;

const hasUnsavedChanges: typeof dashboardApi.hasUnsavedChanges = () =>
  unsavedChanges();

/**
 * Subscribes to the store rather than to the action that sets the flag.
 *
 * `hasUnsavedChanges` is written by more than one action -- editing sets it,
 * saving clears it, hydration resets it, and making a refresh frequency
 * persistent raises it -- so listening for a single action type would miss
 * transitions a subscriber has to see. Comparing the derived value across
 * store updates catches every path, and fires only when the answer actually
 * changed.
 */
const onDidChangeUnsavedChanges: typeof dashboardApi.onDidChangeUnsavedChanges =
  (listener, thisArgs?: any) => {
    const boundListener = thisArgs ? listener.bind(thisArgs) : listener;
    let previous = unsavedChanges();
    const unsubscribe = store.subscribe(() => {
      const current = unsavedChanges();
      if (current !== previous) {
        previous = current;
        boundListener(current);
      }
    });
    return new Disposable(unsubscribe);
  };

const save: typeof dashboardApi.save = async () => {
  saveHandle?.();
};

export const dashboard: typeof dashboardApi = {
  hasUnsavedChanges,
  onDidChangeUnsavedChanges,
  save,
};
