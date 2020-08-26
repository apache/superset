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
import rison from 'rison';
import { useState, useEffect, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';

import { createErrorHandler } from 'src/views/CRUD/utils';
import { FetchDataConfig } from 'src/components/ListView';

interface ListViewResourceState<D extends object = any> {
  loading: boolean;
  collection: D[];
  count: number;
  permissions: string[];
  lastFetchDataConfig: FetchDataConfig | null;
  bulkSelectEnabled: boolean;
}

export function useListViewResource<D extends object = any>(
  resource: string,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
) {
  const [state, setState] = useState<ListViewResourceState<D>>({
    count: 0,
    collection: [],
    loading: true,
    lastFetchDataConfig: null,
    permissions: [],
    bulkSelectEnabled: false,
  });

  function updateState(update: Partial<ListViewResourceState<D>>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  function toggleBulkSelect() {
    updateState({ bulkSelectEnabled: !state.bulkSelectEnabled });
  }

  useEffect(() => {
    SupersetClient.get({
      endpoint: `/api/v1/${resource}/_info`,
    }).then(
      ({ json: infoJson = {} }) => {
        updateState({
          permissions: infoJson.permissions,
        });
      },
      createErrorHandler(errMsg =>
        handleErrorMsg(
          t(
            'An error occurred while fetching %ss info: %s',
            resourceLabel,
            errMsg,
          ),
        ),
      ),
    );
  }, []);

  function hasPerm(perm: string) {
    if (!state.permissions.length) {
      return false;
    }

    return Boolean(state.permissions.find(p => p === perm));
  }

  const fetchData = useCallback(
    ({
      pageIndex,
      pageSize,
      sortBy,
      filters: filterValues,
    }: FetchDataConfig) => {
      // set loading state, cache the last config for refreshing data.
      updateState({
        lastFetchDataConfig: {
          filters: filterValues,
          pageIndex,
          pageSize,
          sortBy,
        },
        loading: true,
      });

      const filterExps = filterValues.map(
        ({ id: col, operator: opr, value }) => ({
          col,
          opr,
          value,
        }),
      );

      const queryParams = rison.encode({
        order_column: sortBy[0].id,
        order_direction: sortBy[0].desc ? 'desc' : 'asc',
        page: pageIndex,
        page_size: pageSize,
        ...(filterExps.length ? { filters: filterExps } : {}),
      });

      return SupersetClient.get({
        endpoint: `/api/v1/${resource}/?q=${queryParams}`,
      })
        .then(
          ({ json = {} }) => {
            updateState({
              collection: json.result,
              count: json.count,
            });
          },
          createErrorHandler(errMsg =>
            handleErrorMsg(
              t(
                'An error occurred while fetching %ss: %s',
                resourceLabel,
                errMsg,
              ),
            ),
          ),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [],
  );

  return {
    state: {
      loading: state.loading,
      resourceCount: state.count,
      resourceCollection: state.collection,
      bulkSelectEnabled: state.bulkSelectEnabled,
    },
    setResourceCollection: (update: D[]) =>
      updateState({
        collection: update,
      }),
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData: () => {
      if (state.lastFetchDataConfig) {
        fetchData(state.lastFetchDataConfig);
      }
    },
  };
}
