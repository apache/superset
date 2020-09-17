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
import { useState, useEffect, useCallback, useRef } from 'react';
import { SupersetClient, t } from '@superset-ui/core';

import { createErrorHandler } from 'src/views/CRUD/utils';
import { FetchDataConfig } from 'src/components/ListView';
import { FavoriteStatus } from './types';

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

// In the same vein as above, a hook for viewing a single instance of a resource (given id)
interface SingleViewResourceState<D extends object = any> {
  loading: boolean;
  resource: D | null;
}

export function useSingleViewResource<D extends object = any>(
  resourceName: string,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
) {
  const [state, setState] = useState<SingleViewResourceState<D>>({
    loading: false,
    resource: null,
  });

  function updateState(update: Partial<SingleViewResourceState<D>>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  const fetchResource = useCallback((resourceID: number) => {
    // Set loading state
    updateState({
      loading: true,
    });

    return SupersetClient.get({
      endpoint: `/api/v1/${resourceName}/${resourceID}`,
    })
      .then(
        ({ json = {} }) => {
          updateState({
            resource: json.result,
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
  }, []);

  const createResource = useCallback((resource: D) => {
    // Set loading state
    updateState({
      loading: true,
    });

    return SupersetClient.post({
      endpoint: `/api/v1/${resourceName}/`,
      body: JSON.stringify(resource),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(
        ({ json = {} }) => {
          updateState({
            resource: json.result,
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
  }, []);

  const updateResource = useCallback((resourceID: number, resource: D) => {
    // Set loading state
    updateState({
      loading: true,
    });

    return SupersetClient.put({
      endpoint: `/api/v1/${resourceName}/${resourceID}`,
      body: JSON.stringify(resource),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(
        ({ json = {} }) => {
          updateState({
            resource: json.result,
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
  }, []);

  return {
    state: {
      loading: state.loading,
      resource: state.resource,
    },
    setResource: (update: D) =>
      updateState({
        resource: update,
      }),
    fetchResource,
    createResource,
    updateResource,
  };
}

// the hooks api has some known limitations around stale state in closures.
// See https://github.com/reactjs/rfcs/blob/master/text/0068-react-hooks.md#drawbacks
// the useRef hook is a way of getting around these limitations by having a consistent ref
// that points to the most recent value.
export function useFavoriteStatus(
  initialState: FavoriteStatus,
  baseURL: string,
  handleErrorMsg: (message: string) => void,
) {
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>(
    initialState,
  );
  const favoriteStatusRef = useRef<FavoriteStatus>(favoriteStatus);
  useEffect(() => {
    favoriteStatusRef.current = favoriteStatus;
  });

  const updateFavoriteStatus = (update: FavoriteStatus) =>
    setFavoriteStatus(currentState => ({ ...currentState, ...update }));

  const fetchFaveStar = (id: number) => {
    SupersetClient.get({
      endpoint: `${baseURL}/${id}/count/`,
    }).then(
      ({ json }) => {
        updateFavoriteStatus({ [id]: json.count > 0 });
      },
      createErrorHandler(errMsg =>
        handleErrorMsg(
          t('There was an error fetching the favorite status: %s', errMsg),
        ),
      ),
    );
  };

  const saveFaveStar = (id: number, isStarred: boolean) => {
    const urlSuffix = isStarred ? 'unselect' : 'select';

    SupersetClient.get({
      endpoint: `${baseURL}/${id}/${urlSuffix}/`,
    }).then(
      () => {
        updateFavoriteStatus({ [id]: !isStarred });
      },
      createErrorHandler(errMsg =>
        handleErrorMsg(
          t('There was an error saving the favorite status: %s', errMsg),
        ),
      ),
    );
  };

  return [favoriteStatusRef, fetchFaveStar, saveFaveStar] as const;
}
