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
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
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
  QueryFormData,
} from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { getParsedExploreURLParams } from 'src/explore/exploreUtils/getParsedExploreURLParams';
import {
  getChartStateFromHistoryState,
  isSameChartState,
  selectRestoreTarget,
} from 'src/explore/exploreUtils/exploreHistory';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import ExploreViewContainer from 'src/explore/components/ExploreViewContainer';
import { ExploreResponsePayload, SaveActionType } from 'src/explore/types';
import { fallbackExploreInitialData } from 'src/explore/fixtures';
import { getItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { getFormDataWithDashboardContext } from 'src/explore/controlUtils/getFormDataWithDashboardContext';
import type Chart from 'src/types/Chart';
import { mapSubjectValuesToIds } from 'src/features/subjects/SubjectPicker';
import { hasDeferralOracle, heldVersion } from 'src/core/deferredWrites';

const isValidResult = (rv: JsonObject): boolean =>
  rv?.result?.form_data && rv?.result?.dataset;

const hasDatasetId = (rv: JsonObject): boolean =>
  isDefined(rv?.result?.dataset?.id);

/**
 * The author's own open change on this chart, as form data to open on.
 *
 * Null for everything else, and null is the whole of the fallback: no open
 * change, somebody else's change, a change that proposes nothing drawable,
 * a chart that has never been saved, review turned off, or a request that
 * failed. Explore then opens on the live chart exactly as it always has.
 *
 * Deliberately quiet on failure. This runs on the load path of every chart
 * page, and a review lookup that did not answer is not a reason to refuse
 * someone their chart or to raise a toast about a feature they may not be
 * using.
 */
const openChartDraft = async (
  result: ExploreResponsePayload['result'],
): Promise<QueryFormData | null> => {
  const sliceId =
    getUrlParam(URL_PARAMS.sliceId) ||
    (result.form_data as JsonObject | undefined)?.slice_id ||
    result.slice?.slice_id;
  if (!sliceId) {
    return null;
  }
  // Already quiet on failure and on an absent answer: the wrapper reports
  // `null` for an oracle that is not there, does not implement this, or
  // throws. Composing the form data -- which fields of a held version
  // replace which of the live chart -- belongs to whoever held the write,
  // because only they know the shape they stored. A chart's held version is
  // form data, which is what this hydrates.
  return (
    ((await heldVersion('chart', Number(sliceId))) as QueryFormData | null) ??
    null
  );
};

const EXPLORE_ROUTE_PREFIX = '/explore/';

const isExploreRoute = (pathname: string): boolean =>
  pathname.startsWith(EXPLORE_ROUTE_PREFIX);

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
  const restoreTarget = useSelector(selectRestoreTarget, shallowEqual);

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

      // A superseded fetch and an aborted one are equally unusable: the abort
      // fires on unmount without touching `fetchGeneration`, so results must be
      // dropped on either signal rather than dispatched into a torn-down page.
      const isStale = () =>
        generation !== fetchGeneration.current || controller.signal.aborted;

      fetchExploreData(exploreUrlParams, controller.signal)
        .then(({ result }) => {
          if (isStale()) {
            return;
          }

          // The author of an open change on this chart opens on their own
          // changes, not on the published chart (sc-131032, and the lost
          // edits that followed from it).
          //
          // It has to happen here, before `hydrateExplore`. Explore builds
          // its controls, its `latestQueryFormData` and its chart entry in
          // one pass from the form data it is handed; writing the proposal
          // in afterwards leaves those disagreeing and took the chart panel
          // down on an undefined `chartStatus` three times. There is no
          // post-load seam to use. Feeding the draft in as the form data
          // means every one of those is built from it and nothing is
          // mutated after the fact.
          const hydrateWith = (draft: QueryFormData | null) => {
            // The draft is the base, and dashboard context still goes over
            // the top: arriving from a dashboard carries that dashboard's
            // filters, and those apply to whichever version is being drawn.
            const live = draft ?? result.form_data;
            const formData = dashboardContextFormData
              ? getFormDataWithDashboardContext(
                  live,
                  dashboardContextFormData,
                  saveAction,
                )
              : live;

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
                // Lets Save tell "you are editing your draft" from "you are
                // editing live over the top of one"; see `SaveModal`.
                openedOnHeldVersion: !!draft,
              }),
            );
          };

          // With nothing registered there is no held version to look for,
          // and asking would put a request in front of every chart page on
          // every deployment, delaying the first render for something that
          // is not installed. Dispatched straight through instead, exactly
          // as it was before any of this. Asked of the registry rather than
          // a named flag: whether anything is holding writes is the
          // question, and the holder is what answers it.
          if (!hasDeferralOracle()) {
            hydrateWith(null);
            return undefined;
          }
          return openChartDraft(result).then(draft => {
            if (isStale()) {
              return;
            }
            hydrateWith(draft);
          });
        })
        .catch(err => {
          // Silently ignore aborted requests - AbortError may be wrapped in SupersetApiError by makeApi
          // or come through with statusText === 'abort' from SupersetClient
          if (
            err.name === 'AbortError' ||
            err.statusText === 'abort' ||
            err.originalError?.name === 'AbortError' ||
            err.originalError?.statusText === 'abort'
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

          // `extra.datasource` is the pre-`is_access_denial` shape of this
          // payload; accepting it keeps the request-access UI working while a
          // rolling deploy still has older API pods answering.
          if (err.extra?.is_access_denial || isDefined(err.extra?.datasource)) {
            // An API pod that predates the fix still names the dataset in
            // `extra`. Drop it before the error is stored — `DatasourceControl`
            // renders this object, and Explore's state must not carry the name
            // of a dataset the user was just denied. Deleted in place rather
            // than spread into a copy, which would lose `Error.message`.
            delete err.extra?.datasource_name;
            const exploreData = {
              ...fallbackExploreInitialData,
              dataset: {
                ...fallbackExploreInitialData.dataset,
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
                    signal: controller.signal,
                  })()
                : Promise.reject()
            )
              .then(
                ({
                  result: {
                    id,
                    url,
                    editors,
                    viewers,
                    form_data: _,
                    // `GET /api/v1/chart/<id>` is granted to any chart viewer
                    // regardless of dataset access, so its payload describes
                    // the dataset this user was just denied: the name/url/uuid
                    // identify it, and params/query_context carry its columns,
                    // metric SQL and filter values. Explore reads none of them
                    // on this path — drop them rather than spreading them into
                    // state. Only the chart's own name and owners are needed.
                    datasource_name_text: _datasourceNameText,
                    datasource_url: _datasourceUrl,
                    datasource_uuid: _datasourceUuid,
                    params: _params,
                    query_context: _queryContext,
                    ...data
                  },
                }) => {
                  if (isStale()) {
                    return;
                  }
                  const slice = {
                    ...data,
                    slice_id: id,
                    slice_url: url,
                    editors: mapSubjectValuesToIds(editors),
                    viewers: mapSubjectValuesToIds(viewers),
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
          if (!isStale()) {
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
  // Entries holding a chart state of the loaded chart are skipped: Explore
  // pushed them itself, and ExploreViewContainer restores a popped one in place.
  // Navigations that leave Explore must not trigger a re-fetch while the page
  // is unmounting, as the destination's URL params are not chart params.
  useEffect(() => {
    const unlisten = history.listen((loc: Location, action: Action) => {
      const saveAction = (loc.state as Record<string, unknown>)?.saveAction as
        | SaveActionType
        | undefined;
      const chartState = getChartStateFromHistoryState(loc.state);
      if (chartState) {
        if (action === 'PUSH') {
          return;
        }
        if (action === 'POP' && isSameChartState(chartState, restoreTarget)) {
          return;
        }
      }
      if (!isExploreRoute(loc.pathname)) {
        return;
      }
      if (action === 'PUSH' || action === 'POP') {
        setIsLoaded(false);
        loadExploreData(loc, saveAction);
      } else if (saveAction) {
        loadExploreData(loc, saveAction);
      }
    });
    return unlisten;
  }, [history, loadExploreData, restoreTarget]);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
}
