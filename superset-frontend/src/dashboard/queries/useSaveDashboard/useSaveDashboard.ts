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
import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { JsonObject } from '@superset-ui/core';
import type { RootState } from 'src/dashboard/types';
import { saveDashboardRequest } from 'src/dashboard/actions/dashboardState';
import { useDashboardStateStore } from 'src/dashboard/stores';

interface SaveDashboardVariables {
  data: JsonObject;
  id: number;
  saveType: string;
}

/**
 * Wraps the saveDashboardRequest thunk in a TanStack mutation so `isPending`
 * can drive the Save-button disable. The thunk owns the save side effects.
 */
export function useSaveDashboard() {
  // Thunk-aware dispatch so `dispatch(saveDashboardRequest(...))` is typed.
  const dispatch =
    useDispatch<ThunkDispatch<RootState, undefined, AnyAction>>();

  return useMutation({
    mutationFn: ({ data, id, saveType }: SaveDashboardVariables) =>
      dispatch(
        saveDashboardRequest(data, id, saveType),
      ) as Promise<JsonObject | void>,
    onSuccess: data => {
      // No response = overwrite precheck deferred the save; stay in edit mode.
      if (data) {
        useDashboardStateStore.getState().setEditMode(false);
      }
    },
  });
}
