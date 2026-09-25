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
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, RootState } from 'src/dashboard/types';
import { updateComponents } from './dashboardLayout';

// Match the local pattern used by `dashboardLayout.ts` and `hydrate.ts` —
// the project doesn't export a shared `AppDispatch` from
// `src/dashboard/types`; the closest exported one is
// `src/views/store`'s `typeof store.dispatch`, which we don't want to
// import here just to type a thunk.
type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/**
 * Sets (or clears) the per-component theme override on a dashboard
 * grid component. `themeId === null` clears the override and falls back
 * to the inherited theme.
 *
 * Thin wrapper around `updateComponents` that touches only the `themeId`
 * key on the component's `meta`, preserving every other meta field. Used
 * by `ThemeSelectorModal` (and any future call site) so the meta-merge
 * logic lives in one place.
 */
export function setComponentThemeId(
  componentId: string,
  themeId: number | null,
) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout } = getState();
    const component = dashboardLayout.present[componentId];
    if (!component) return;
    dispatch(
      updateComponents({
        [componentId]: {
          ...component,
          meta: {
            ...component.meta,
            themeId,
          },
        },
      }),
    );
  };
}
