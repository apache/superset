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
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import isEqual from 'lodash/isEqual';
import { t } from '@apache-superset/core/translation';
import {
  addSuccessToast,
  removeToast,
} from 'src/components/MessageToasts/actions';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import { subscribeRealtime } from 'src/middleware/realtime';
import { getPermalinkValue } from 'src/dashboard/queries';

/** Apply chat permalink state to the mounted dashboard, with one-shot undo. */
export default function useDashboardFilterSync(dashboardId?: number) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!dashboardId) return undefined;

    let active = true;
    let request = 0;
    let appliedRequest = 0;
    let toastId: string | undefined;
    const dismissToast = () => {
      if (toastId) dispatch(removeToast(toastId));
      toastId = undefined;
    };
    const unsubscribe = subscribeRealtime(
      'dashboard.filters_applied',
      async payload => {
        if (
          !active ||
          typeof payload !== 'object' ||
          payload === null ||
          !('dashboard_id' in payload) ||
          payload.dashboard_id !== dashboardId ||
          !('permalink_key' in payload) ||
          typeof payload.permalink_key !== 'string' ||
          !payload.permalink_key
        ) {
          return;
        }
        request += 1;
        const version = request;
        try {
          const value = await getPermalinkValue(payload.permalink_key);
          const mask = value?.state?.dataMask;
          if (!active || version !== request || !mask) return;
          const entries = Object.entries(mask);
          if (!entries.length) return;

          // Read at application time, including edits made during the fetch.
          const previous = useDataMaskStore.getState().dataMask;
          appliedRequest = version;
          dismissToast();
          entries.forEach(([id, dataMask]) => {
            dispatch(updateDataMask(id, dataMask));
          });
          const applied = useDataMaskStore.getState().dataMask;
          let undone = false;
          // No duration override: an actionable toast has no auto-dismiss
          // timer, so it stays up until Undo or the close button is used.
          const toast = addSuccessToast(t('Filters applied from chat'), {
            action: {
              label: t('Undo'),
              onClick: () => {
                if (!active || undone || version !== appliedRequest) return;
                undone = true;
                entries.forEach(([id]) => {
                  const current = useDataMaskStore.getState().dataMask;
                  if (!isEqual(current[id], applied[id])) {
                    return;
                  }
                  // Remove first: updateDataMask merges rather than replaces.
                  dispatch(removeDataMask(id));
                  if (Object.prototype.hasOwnProperty.call(previous, id)) {
                    dispatch(updateDataMask(id, previous[id]));
                  }
                });
                dismissToast();
              },
            },
          });
          toastId = toast.payload.id;
          dispatch(toast);
        } catch {
          // Best effort: the chat permalink remains the fallback on failure.
        }
      },
    );
    // Do not replay state on reconnect: a remembered key could overwrite
    // manual edits or undo, and cannot recover missed notifications.
    return () => {
      active = false;
      unsubscribe();
      dismissToast();
    };
  }, [dashboardId, dispatch]);
}
