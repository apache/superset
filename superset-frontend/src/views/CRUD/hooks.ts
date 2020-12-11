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
import { makeApi, SupersetClient, t } from '@superset-ui/core';

import { createErrorHandler } from 'src/views/CRUD/utils';
import { FetchDataConfig } from 'src/components/ListView';
import { FilterValue } from 'src/components/ListView/types';
import Chart, { Slice } from 'src/types/Chart';
import copyTextToClipboard from 'src/utils/copy';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
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
  infoEnable = true,
  defaultCollectionValue: D[] = [],
  baseFilters: FilterValue[] = [], // must be memoized
) {
  const [state, setState] = useState<ListViewResourceState<D>>({
    count: 0,
    collection: defaultCollectionValue,
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
    if (!infoEnable) return;
    SupersetClient.get({
      endpoint: `/api/v1/${resource}/_info?q=${rison.encode({
        keys: ['permissions'],
      })}`,
    }).then(
      ({ json: infoJson = {} }) => {
        updateState({
          permissions: infoJson.permissions,
        });
      },
      createErrorHandler(errMsg =>
        handleErrorMsg(
          t(
            'An error occurred while fetching %s info: %s',
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

      const filterExps = baseFilters
        .concat(filterValues)
        .map(({ id: col, operator: opr, value }) => ({
          col,
          opr,
          value,
        }));

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
    [baseFilters.length ? baseFilters : null],
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
    refreshData: (provideConfig?: FetchDataConfig) => {
      if (state.lastFetchDataConfig) {
        return fetchData(state.lastFetchDataConfig);
      }
      if (provideConfig) {
        return fetchData(provideConfig);
      }
      return null;
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
          return json.result;
        },
        createErrorHandler(errMsg =>
          handleErrorMsg(
            t(
              'An error occurred while fetching %ss: %s',
              resourceLabel,
              JSON.stringify(errMsg),
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
          return json.id;
        },
        createErrorHandler(errMsg =>
          handleErrorMsg(
            t(
              'An error occurred while creating %ss: %s',
              resourceLabel,
              JSON.stringify(errMsg),
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
          return json.result;
        },
        createErrorHandler(errMsg =>
          handleErrorMsg(
            t(
              'An error occurred while fetching %ss: %s',
              resourceLabel,
              JSON.stringify(errMsg),
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

interface ImportResourceState<D extends object = any> {
  loading: boolean;
  passwordsNeeded: string[];
}

export function useImportResource<D extends object = any>(
  resourceName: string,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
) {
  const [state, setState] = useState<ImportResourceState<D>>({
    loading: false,
    passwordsNeeded: [],
  });

  function updateState(update: Partial<ImportResourceState<D>>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  const needsPassword = (errMsg: Record<string, Record<string, string[]>>) =>
    Object.values(errMsg).every(validationErrors =>
      Object.entries(validationErrors as Object).every(
        ([field, messages]) =>
          field === '_schema' &&
          messages.length === 1 &&
          messages[0] === 'Must provide a password for the database',
      ),
    );

  const importResource = useCallback(
    (bundle: File, databasePasswords: Record<string, string> = {}) => {
      // Set loading state
      updateState({
        loading: true,
      });

      const formData = new FormData();
      formData.append('formData', bundle);

      /* The import bundle never contains database passwords; if required
       * they should be provided by the user during import.
       */
      if (databasePasswords) {
        formData.append('passwords', JSON.stringify(databasePasswords));
      }

      return SupersetClient.post({
        endpoint: `/api/v1/${resourceName}/import/`,
        body: formData,
      })
        .then(() => true)
        .catch(response =>
          getClientErrorObject(response).then(error => {
            /* When importing a bundle, if all validation errors are because
             * the databases need passwords we return a list of the database
             * files so that the user can type in the passwords and resubmit
             * the file.
             */
            const errMsg = error.message || error.error;
            if (typeof errMsg !== 'string' && needsPassword(errMsg)) {
              updateState({
                passwordsNeeded: Object.keys(errMsg),
              });
              return false;
            }
            handleErrorMsg(
              t(
                'An error occurred while importing %s: %s',
                resourceLabel,
                JSON.stringify(errMsg),
              ),
            );
            return false;
          }),
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
      passwordsNeeded: state.passwordsNeeded,
    },
    importResource,
  };
}

enum FavStarClassName {
  CHART = 'slice',
  DASHBOARD = 'Dashboard',
}

type FavoriteStatusResponse = {
  result: Array<{
    id: string;
    value: boolean;
  }>;
};

const favoriteApis = {
  chart: makeApi<string, FavoriteStatusResponse>({
    requestType: 'search',
    method: 'GET',
    endpoint: '/api/v1/chart/favorite_status',
  }),
  dashboard: makeApi<string, FavoriteStatusResponse>({
    requestType: 'search',
    method: 'GET',
    endpoint: '/api/v1/dashboard/favorite_status',
  }),
};

export function useFavoriteStatus(
  type: 'chart' | 'dashboard',
  ids: Array<string | number>,
  handleErrorMsg: (message: string) => void,
) {
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>({});

  const updateFavoriteStatus = (update: FavoriteStatus) =>
    setFavoriteStatus(currentState => ({ ...currentState, ...update }));

  useEffect(() => {
    if (!ids.length) {
      return;
    }
    favoriteApis[type](`q=${rison.encode(ids)}`).then(
      ({ result }) => {
        const update = result.reduce((acc, element) => {
          acc[element.id] = element.value;
          return acc;
        }, {});
        updateFavoriteStatus(update);
      },
      createErrorHandler(errMsg =>
        handleErrorMsg(
          t('There was an error fetching the favorite status: %s', errMsg),
        ),
      ),
    );
  }, [ids]);

  const saveFaveStar = useCallback(
    (id: number, isStarred: boolean) => {
      const urlSuffix = isStarred ? 'unselect' : 'select';
      SupersetClient.get({
        endpoint: `/superset/favstar/${
          type === 'chart' ? FavStarClassName.CHART : FavStarClassName.DASHBOARD
        }/${id}/${urlSuffix}/`,
      }).then(
        ({ json }) => {
          updateFavoriteStatus({
            [id]: (json as { count: number })?.count > 0,
          });
        },
        createErrorHandler(errMsg =>
          handleErrorMsg(
            t('There was an error saving the favorite status: %s', errMsg),
          ),
        ),
      );
    },
    [type],
  );

  return [saveFaveStar, favoriteStatus] as const;
}

export const useChartEditModal = (
  setCharts: (charts: Array<Chart>) => void,
  charts: Array<Chart>,
) => {
  const [
    sliceCurrentlyEditing,
    setSliceCurrentlyEditing,
  ] = useState<Slice | null>(null);

  function openChartEditModal(chart: Chart) {
    setSliceCurrentlyEditing({
      slice_id: chart.id,
      slice_name: chart.slice_name,
      description: chart.description,
      cache_timeout: chart.cache_timeout,
    });
  }

  function closeChartEditModal() {
    setSliceCurrentlyEditing(null);
  }

  function handleChartUpdated(edits: Chart) {
    // update the chart in our state with the edited info
    const newCharts = charts.map((chart: Chart) =>
      chart.id === edits.id ? { ...chart, ...edits } : chart,
    );
    setCharts(newCharts);
  }

  return {
    sliceCurrentlyEditing,
    handleChartUpdated,
    openChartEditModal,
    closeChartEditModal,
  };
};

export const copyQueryLink = (
  id: number,
  addDangerToast: (arg0: string) => void,
  addSuccessToast: (arg0: string) => void,
) => {
  copyTextToClipboard(
    `${window.location.origin}/superset/sqllab?savedQueryId=${id}`,
  )
    .then(() => {
      addSuccessToast(t('Link Copied!'));
    })
    .catch(() => {
      addDangerToast(t('Sorry, your browser does not support copying.'));
    });
};
