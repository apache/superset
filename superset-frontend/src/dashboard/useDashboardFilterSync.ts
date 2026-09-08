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
import { useDispatch, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import {
  addSuccessToast,
  removeToast,
} from 'src/components/MessageToasts/actions';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import {
  subscribeRealtime,
  subscribeRealtimeOpen,
} from 'src/middleware/realtime';
import { RootState } from './types';
import { getPermalinkValue } from './components/nativeFilters/FilterBar/keyValue';

/** Apply chat permalink state to the mounted dashboard, with one-shot undo. */
export default function useDashboardFilterSync(dashboardId?: number) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();

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
          const previous = store.getState().dataMask;
          appliedRequest = version;
          dismissToast();
          entries.forEach(([id, dataMask]) => {
            dispatch(updateDataMask(id, dataMask));
          });
          let undone = false;
          const toast = addSuccessToast(t('Filters applied from chat'), {
            duration: 8000,
            action: {
              label: t('Undo'),
              onClick: () => {
                if (!active || undone || version !== appliedRequest) return;
                undone = true;
                entries.forEach(([id]) => {
                  // Remove first: updateDataMask merges rather than replaces.
                  dispatch(removeDataMask(id));
                  if (previous[id]) dispatch(updateDataMask(id, previous[id]));
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
    const unsubscribeOpen = subscribeRealtimeOpen(reason => {
      if (reason !== 'reconnect') return;
      // Deliberately no fetch: there is no latest-per-principal permalink API.
      // Replaying a remembered key could overwrite manual edits or undo, and
      // cannot recover a missed key. The permalink in chat is the backstop.
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeOpen();
      dismissToast();
    };
  }, [dashboardId, dispatch, store]);
}
