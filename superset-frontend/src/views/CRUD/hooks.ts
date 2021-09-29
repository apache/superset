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
import { makeApi, SupersetClient, t, JsonObject } from '@superset-ui/core';

import {
  createErrorHandler,
  getAlreadyExists,
  getPasswordsNeeded,
  hasTerminalValidation,
} from 'src/views/CRUD/utils';
import { FetchDataConfig } from 'src/components/ListView';
import { FilterValue } from 'src/components/ListView/types';
import Chart, { Slice } from 'src/types/Chart';
import copyTextToClipboard from 'src/utils/copy';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import SupersetText from 'src/utils/textUtils';
import { FavoriteStatus, ImportResourceName, DatabaseObject } from './types';

interface ListViewResourceState<D extends object = any> {
  loading: boolean;
  collection: D[];
  count: number;
  permissions: string[];
  lastFetchDataConfig: FetchDataConfig | null;
  bulkSelectEnabled: boolean;
  lastFetched?: string;
}

const parsedErrorMessage = (
  errorMessage: Record<string, string[] | string> | string,
) => {
  if (typeof errorMessage === 'string') {
    return errorMessage;
  }
  return Object.entries(errorMessage)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `(${key}) ${value.join(', ')}`;
      }
      return `(${key}) ${value}`;
    })
    .join('\n');
};

export function useListViewResource<D extends object = any>(
  resource: string,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
  infoEnable = true,
  defaultCollectionValue: D[] = [],
  baseFilters?: FilterValue[], // must be memoized
  initialLoadingState = true,
) {
  const [state, setState] = useState<ListViewResourceState<D>>({
    count: 0,
    collection: defaultCollectionValue,
    loading: initialLoadingState,
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

      const filterExps = (baseFilters || [])
        .concat(filterValues)
        .map(({ id, operator: opr, value }) => ({
          col: id,
          opr,
          value:
            value && typeof value === 'object' && 'value' in value
              ? value.value
              : value,
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
              lastFetched: new Date().toISOString(),
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
    [baseFilters],
  );

  return {
    state: {
      loading: state.loading,
      resourceCount: state.count,
      resourceCollection: state.collection,
      bulkSelectEnabled: state.bulkSelectEnabled,
      lastFetched: state.lastFetched,
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
  error: any | null;
}

export function useSingleViewResource<D extends object = any>(
  resourceName: string,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
) {
  const [state, setState] = useState<SingleViewResourceState<D>>({
    loading: false,
    resource: null,
    error: null,
  });

  function updateState(update: Partial<SingleViewResourceState<D>>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  const fetchResource = useCallback(
    (resourceID: number) => {
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
              error: null,
            });
            return json.result;
          },
          createErrorHandler((errMsg: Record<string, string[] | string>) => {
            handleErrorMsg(
              t(
                'An error occurred while fetching %ss: %s',
                resourceLabel,
                parsedErrorMessage(errMsg),
              ),
            );

            updateState({
              error: errMsg,
            });
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [handleErrorMsg, resourceName, resourceLabel],
  );

  const createResource = useCallback(
    (resource: D, hideToast = false) => {
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
              resource: { id: json.id, ...json.result },
              error: null,
            });
            return json.id;
          },
          createErrorHandler((errMsg: Record<string, string[] | string>) => {
            // we did not want toasts for db-connection-ui but did not want to disable it everywhere
            if (!hideToast) {
              handleErrorMsg(
                t(
                  'An error occurred while creating %ss: %s',
                  resourceLabel,
                  parsedErrorMessage(errMsg),
                ),
              );
            }

            updateState({
              error: errMsg,
            });
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [handleErrorMsg, resourceName, resourceLabel],
  );

  const updateResource = useCallback(
    (resourceID: number, resource: D, hideToast = false) => {
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
              resource: { ...json.result, id: json.id },
              error: null,
            });
            return json.result;
          },
          createErrorHandler(errMsg => {
            if (!hideToast) {
              handleErrorMsg(
                t(
                  'An error occurred while fetching %ss: %s',
                  resourceLabel,
                  JSON.stringify(errMsg),
                ),
              );
            }

            updateState({
              error: errMsg,
            });

            return errMsg;
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [handleErrorMsg, resourceName, resourceLabel],
  );
  const clearError = () =>
    updateState({
      error: null,
    });

  return {
    state,
    setResource: (update: D) =>
      updateState({
        resource: update,
      }),
    fetchResource,
    createResource,
    updateResource,
    clearError,
  };
}

interface ImportResourceState {
  loading: boolean;
  passwordsNeeded: string[];
  alreadyExists: string[];
}

export function useImportResource(
  resourceName: ImportResourceName,
  resourceLabel: string, // resourceLabel for translations
  handleErrorMsg: (errorMsg: string) => void,
) {
  const [state, setState] = useState<ImportResourceState>({
    loading: false,
    passwordsNeeded: [],
    alreadyExists: [],
  });

  function updateState(update: Partial<ImportResourceState>) {
    setState(currentState => ({ ...currentState, ...update }));
  }

  const importResource = useCallback(
    (
      bundle: File,
      databasePasswords: Record<string, string> = {},
      overwrite = false,
    ) => {
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
      /* If the imported model already exists the user needs to confirm
       * that they want to overwrite it.
       */
      if (overwrite) {
        formData.append('overwrite', 'true');
      }

      return SupersetClient.post({
        endpoint: `/api/v1/${resourceName}/import/`,
        body: formData,
      })
        .then(() => true)
        .catch(response =>
          getClientErrorObject(response).then(error => {
            if (!error.errors) {
              handleErrorMsg(
                t(
                  'An error occurred while importing %s: %s',
                  resourceLabel,
                  error.message || error.error,
                ),
              );
              return false;
            }
            if (hasTerminalValidation(error.errors)) {
              handleErrorMsg(
                t(
                  'An error occurred while importing %s: %s',
                  resourceLabel,
                  error.errors.map(payload => payload.message).join('\n'),
                ),
              );
            } else {
              updateState({
                passwordsNeeded: getPasswordsNeeded(error.errors),
                alreadyExists: getAlreadyExists(error.errors),
              });
            }
            return false;
          }),
        )
        .finally(() => {
          updateState({ loading: false });
        });
    },
    [],
  );

  return { state, importResource };
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
  chart: makeApi<Array<string | number>, FavoriteStatusResponse>({
    requestType: 'rison',
    method: 'GET',
    endpoint: '/api/v1/chart/favorite_status/',
  }),
  dashboard: makeApi<Array<string | number>, FavoriteStatusResponse>({
    requestType: 'rison',
    method: 'GET',
    endpoint: '/api/v1/dashboard/favorite_status/',
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
    favoriteApis[type](ids).then(
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
  }, [ids, type, handleErrorMsg]);

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

export const getDatabaseImages = () => SupersetText.DB_IMAGES;

export const getConnectionAlert = () => SupersetText.DB_CONNECTION_ALERTS;
export const getDatabaseDocumentationLinks = () =>
  SupersetText.DB_CONNECTION_DOC_LINKS;

export const testDatabaseConnection = (
  connection: DatabaseObject,
  handleErrorMsg: (errorMsg: string) => void,
  addSuccessToast: (arg0: string) => void,
) => {
  SupersetClient.post({
    endpoint: 'api/v1/database/test_connection',
    body: JSON.stringify(connection),
    headers: { 'Content-Type': 'application/json' },
  }).then(
    () => {
      addSuccessToast(t('Connection looks good!'));
    },
    createErrorHandler((errMsg: Record<string, string[] | string> | string) => {
      handleErrorMsg(t(`${t('ERROR: ')}${parsedErrorMessage(errMsg)}`));
    }),
  );
};

export function useAvailableDatabases() {
  const [availableDbs, setAvailableDbs] = useState<JsonObject | null>(null);

  const getAvailable = useCallback(() => {
    SupersetClient.get({
      endpoint: `/api/v1/database/available/`,
    }).then(({ json }) => {
      setAvailableDbs(json);
    });
  }, [setAvailableDbs]);

  return [availableDbs, getAvailable] as const;
}

export function useDatabaseValidation() {
  const [validationErrors, setValidationErrors] = useState<JsonObject | null>(
    null,
  );
  const getValidation = useCallback(
    (database: Partial<DatabaseObject> | null, onCreate = false) => {
      SupersetClient.post({
        endpoint: '/api/v1/database/validate_parameters',
        body: JSON.stringify(database),
        headers: { 'Content-Type': 'application/json' },
      })
        .then(() => {
          setValidationErrors(null);
        })
        .catch(e => {
          if (typeof e.json === 'function') {
            e.json().then(({ errors = [] }: JsonObject) => {
              const parsedErrors = errors
                .filter((error: { error_type: string }) => {
                  const skipValidationError = ![
                    'CONNECTION_MISSING_PARAMETERS_ERROR',
                    'CONNECTION_ACCESS_DENIED_ERROR',
                  ].includes(error.error_type);
                  return skipValidationError || onCreate;
                })
                .reduce(
                  (
                    obj: {},
                    {
                      error_type,
                      extra,
                      message,
                    }: {
                      error_type: string;
                      extra: {
                        invalid?: string[];
                        missing?: string[];
                        name: string;
                        catalog: {
                          name: string;
                          url: string;
                          idx: number;
                        };
                      };
                      message: string;
                    },
                  ) => {
                    if (extra.catalog) {
                      if (extra.catalog.name) {
                        return {
                          ...obj,
                          error_type,
                          [extra.catalog.idx]: {
                            name: message,
                          },
                        };
                      }
                      if (extra.catalog.url) {
                        return {
                          ...obj,
                          error_type,
                          [extra.catalog.idx]: {
                            url: message,
                          },
                        };
                      }

                      return {
                        ...obj,
                        error_type,
                        [extra.catalog.idx]: {
                          name: message,
                          url: message,
                        },
                      };
                    }
                    // if extra.invalid doesn't exist then the
                    // error can't be mapped to a parameter
                    // so leave it alone
                    if (extra.invalid) {
                      return {
                        ...obj,
                        [extra.invalid[0]]: message,
                        error_type,
                      };
                    }
                    if (extra.missing) {
                      return {
                        ...obj,
                        error_type,
                        ...Object.assign(
                          {},
                          ...extra.missing.map(field => ({
                            [field]: 'This is a required field',
                          })),
                        ),
                      };
                    }
                    return obj;
                  },
                  {},
                );
              setValidationErrors(parsedErrors);
            });
          } else {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        });
    },
    [setValidationErrors],
  );

  return [validationErrors, getValidation, setValidationErrors] as const;
}
