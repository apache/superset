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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import type { Location, Action } from 'history';
import { t } from '@apache-superset/core/translation';
import {
  getLabelsColorMap,
  isDefined,
  JsonObject,
  makeApi,
  LabelsColorMapSource,
  getClientErrorObject,
} from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { getParsedExploreURLParams } from 'src/explore/exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import ExploreViewContainer from 'src/explore/components/ExploreViewContainer';
import { ExploreResponsePayload, SaveActionType } from 'src/explore/types';
import { fallbackExploreInitialData } from 'src/explore/fixtures';
import { getItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { getFormDataWithDashboardContext } from 'src/explore/controlUtils/getFormDataWithDashboardContext';
import type Chart from 'src/types/Chart';

const isValidResult = (rv: JsonObject): boolean =>
  rv?.result?.form_data && rv?.result?.dataset;

const hasDatasetId = (rv: JsonObject): boolean =>
  isDefined(rv?.result?.dataset?.id);

const fetchExploreData = async (
  exploreUrlParams: URLSearchParams,
  signal?: AbortSignal,
) => {
  const rv = await makeApi<{}, ExploreResponsePayload>({
    method: 'GET',
    endpoint: 'api/v1/explore/',
    signal,
  })(exploreUrlParams);
  if (isValidResult(rv)) {
    if (hasDatasetId(rv)) {
      return rv;
    }
    // Since there's no dataset id but the API responded with a valid payload,
    // we assume the dataset was deleted, so we preserve some values from previous
    // state so if the user decide to swap the datasource, the chart config remains
    fallbackExploreInitialData.form_data = {
      ...rv.result.form_data,
      ...fallbackExploreInitialData.form_data,
    };
    if (rv.result?.slice) {
      fallbackExploreInitialData.slice = rv.result.slice;
    }
  }
  let message = t('Failed to load chart data');
  const responseError = rv?.result?.message;
  if (responseError) {
    message = `${message}:\n${responseError}`;
  }
  throw new Error(message);
};

const getDashboardPageContext = (pageId?: string | null) => {
  if (!pageId) {
    return null;
  }
  return getItem(LocalStorageKeys.DashboardExploreContext, {})[pageId] || null;
};

const getDashboardContextFormData = (search: string) => {
  const dashboardPageId = getUrlParam(URL_PARAMS.dashboardPageId, search);
  const dashboardContext = getDashboardPageContext(dashboardPageId);
  if (dashboardContext) {
    const sliceId = getUrlParam(URL_PARAMS.sliceId, search) || 0;
    const {
      colorScheme,
      labelsColor,
      labelsColorMap,
      sharedLabelsColors,
      chartConfiguration,
      nativeFilters,
      filterBoxFilters,
      dataMask,
      dashboardId,
      activeFilters,
    } = dashboardContext;

    const dashboardContextWithFilters = getFormDataWithExtraFilters({
      chart: { id: sliceId },
      filters: getAppliedFilterValues(sliceId, filterBoxFilters),
      nativeFilters,
      chartConfiguration,
      chartCustomizationItems: [],
      dataMask,
      colorScheme,
      labelsColor,
      labelsColorMap,
      sharedLabelsColors,
      sliceId,
      allSliceIds: [sliceId],
      extraControls: {},
      ...(activeFilters && { activeFilters }),
    });
    Object.assign(dashboardContextWithFilters, {
      dashboardId,
    });
    return dashboardContextWithFilters;
  }
  return null;
};

export default function ExplorePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const fetchGeneration = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dispatch = useDispatch();
  const history = useHistory();

  const loadExploreData = useCallback(
    (
      loc: { search: string; pathname: string },
      saveAction?: SaveActionType | null,
    ) => {
      // Abort any in-flight request before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      fetchGeneration.current += 1;
      const generation = fetchGeneration.current;
      const exploreUrlParams = getParsedExploreURLParams(loc);
      const dashboardContextFormData = getDashboardContextFormData(loc.search);

      const isStale = () => generation !== fetchGeneration.current;

      fetchExploreData(exploreUrlParams, controller.signal)
        .then(({ result }) => {
          if (isStale()) {
            return;
          }

          const formData = dashboardContextFormData
            ? getFormDataWithDashboardContext(
                result.form_data,
                dashboardContextFormData,
                saveAction,
              )
            : result.form_data;

          let chartStates: Record<number, JsonObject> | undefined;
          if (result.chartState) {
            const sliceId =
              getUrlParam(URL_PARAMS.sliceId) ||
              (formData as JsonObject).slice_id ||
              0;
            chartStates = {
              [sliceId]: {
                chartId: sliceId,
                state: result.chartState,
                lastModified: Date.now(),
              },
            };
          }

          dispatch(
            hydrateExplore({
              ...result,
              form_data: formData,
              saveAction,
              chartStates,
            }),
          );
        })
        .catch(err => {
          // Silently ignore aborted requests - AbortError may be wrapped in SupersetApiError by makeApi
          if (
            err.name === 'AbortError' ||
            err.originalError?.name === 'AbortError'
          ) {
            return;
          }
          return Promise.all([getClientErrorObject(err), err]);
        })
        .then(resolved => {
          if (isStale()) {
            return;
          }

          const [clientError, err] = resolved || [];
          if (!err) {
            return Promise.resolve();
          }
          const errorMesage =
            clientError?.message ||
            clientError?.error ||
            t('Failed to load chart data.');
          dispatch(addDangerToast(errorMesage));

          if (err.extra?.datasource) {
            const exploreData = {
              ...fallbackExploreInitialData,
              dataset: {
                ...fallbackExploreInitialData.dataset,
                id: err.extra?.datasource,
                name: err.extra?.datasource_name,
                extra: {
                  error: err,
                },
              },
            };
            const chartId = exploreUrlParams.get('slice_id');
            return (
              chartId
                ? makeApi<void, { result: Chart }>({
                    method: 'GET',
                    endpoint: `api/v1/chart/${chartId}`,
                  })()
                : Promise.reject()
            )
              .then(
                ({ result: { id, url, owners, form_data: _, ...data } }) => {
                  if (isStale()) {
                    return;
                  }
                  const slice = {
                    ...data,
                    datasource: err.extra?.datasource_name,
                    slice_id: id,
                    slice_url: url,
                    owners: owners?.map(({ id }) => id),
                  };
                  dispatch(
                    hydrateExplore({
                      ...exploreData,
                      slice,
                    }),
                  );
                },
              )
              .catch(() => {
                if (isStale()) {
                  return;
                }
                dispatch(hydrateExplore(exploreData));
              });
          }
          dispatch(hydrateExplore(fallbackExploreInitialData));
          return Promise.resolve();
        })
        .finally(() => {
          if (!isStale() && !controller.signal.aborted) {
            setIsLoaded(true);
          }
        });
    },
    [dispatch],
  );

  // Cleanup: abort in-flight requests on unmount
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  // Initial fetch on mount
  useEffect(() => {
    loadExploreData(history.location);
    getLabelsColorMap().source = LabelsColorMapSource.Explore;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on navigation or post-save.
  // PUSH/POP: full reload (unmount + re-fetch).
  // REPLACE with saveAction state: re-fetch without unmount (keeps chart visible).
  // Other REPLACE: ignored (URL sync from updateHistory).
  useEffect(() => {
    const unlisten = history.listen((loc: Location, action: Action) => {
      const saveAction = (loc.state as Record<string, unknown>)?.saveAction as
        | SaveActionType
        | undefined;
      if (action === 'PUSH' || action === 'POP') {
        setIsLoaded(false);
        loadExploreData(loc, saveAction);
      } else if (saveAction) {
        loadExploreData(loc, saveAction);
      }
    });
    return unlisten;
  }, [history, loadExploreData]);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
}
