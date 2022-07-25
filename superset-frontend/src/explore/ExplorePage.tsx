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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import pick from 'lodash/pick';
import {
  isDefined,
  JsonObject,
  makeApi,
  QueryFormData,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import Loading from 'src/components/Loading';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { RootState } from 'src/dashboard/types';
import { Slice } from 'src/types/Chart';
import { getItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';
import { getFormDataWithDashboardContext } from './controlUtils/getFormDataWithDashboardContext';

const isResult = (rv: JsonObject): rv is ExploreResponsePayload =>
  rv?.result?.form_data &&
  rv?.result?.dataset &&
  isDefined(rv?.result?.dataset?.id);

const fetchExploreData = async (exploreUrlParams: URLSearchParams) => {
  try {
    const rv = await makeApi<{}, ExploreResponsePayload>({
      method: 'GET',
      endpoint: 'api/v1/explore/',
    })(exploreUrlParams);
    if (isResult(rv)) {
      return rv;
    }
    throw new Error(t('Failed to load chart data.'));
  } catch (err) {
    // todo: encapsulate the error handler
    const clientError = await getClientErrorObject(err);
    throw new Error(
      clientError.message ||
        clientError.error ||
        t('Failed to load chart data.'),
    );
  }
};

const getDashboardContextFormData = () => {
  const dashboardPageId = getUrlParam(URL_PARAMS.dashboardPageId);
  const sliceId = getUrlParam(URL_PARAMS.sliceId) || 0;
  let dashboardContextWithFilters = {};
  if (dashboardPageId) {
    const {
      labelColors,
      sharedLabelColors,
      colorScheme,
      chartConfiguration,
      nativeFilters,
      filterBoxFilters,
      dataMask,
      dashboardId,
    } =
      getItem(LocalStorageKeys.dashboard__explore_context, {})[
        dashboardPageId
      ] || {};
    dashboardContextWithFilters = getFormDataWithExtraFilters({
      chart: { id: sliceId },
      filters: getAppliedFilterValues(sliceId, filterBoxFilters),
      nativeFilters,
      chartConfiguration,
      colorScheme,
      dataMask,
      labelColors,
      sharedLabelColors,
      sliceId,
      allSliceIds: [sliceId],
      extraControls: {},
    });
    Object.assign(dashboardContextWithFilters, { dashboardId });
    return dashboardContextWithFilters;
  }
  return {};
};

const useExploreInitialData = () => {
  const location = useLocation<{ fromDashboard?: number }>();
  const sliceId = getUrlParam(URL_PARAMS.sliceId);
  const exploreUrlParams = getParsedExploreURLParams(location);
  const fromDashboard = isDefined(location.state?.fromDashboard);
  const slice = useSelector<RootState, Slice | null>(({ sliceEntities }) =>
    isDefined(sliceId) ? sliceEntities?.slices?.[sliceId] : null,
  );
  const formData = useSelector<RootState, QueryFormData | null>(state =>
    isDefined(sliceId) ? state.charts?.[sliceId]?.form_data : null,
  );
  const { id: datasourceId, type: datasourceType } = useSelector<
    RootState,
    { id: number | undefined; type: string | undefined }
  >(({ datasources }) =>
    formData?.datasource
      ? pick(datasources[formData.datasource], ['id', 'type'])
      : { id: undefined, type: undefined },
  );
  return useCallback(() => {
    if (
      !fromDashboard ||
      !isDefined(slice) ||
      !isDefined(formData) ||
      !isDefined(datasourceId) ||
      !isDefined(datasourceType)
    ) {
      return fetchExploreData(exploreUrlParams);
    }
    return SupersetClient.get({
      endpoint: `/datasource/get/${datasourceType}/${datasourceId}/`,
    }).then(({ json }) => ({
      result: {
        slice,
        form_data: formData,
        dataset: json as Dataset,
        message: '',
      },
    }));
    /* eslint-disable react-hooks/exhaustive-deps */
  }, []);
};

export default function ExplorePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const isExploreInitialized = useRef(false);
  const dispatch = useDispatch();
  const getExploreInitialData = useExploreInitialData();

  useEffect(() => {
    const isSaveAction = !!getUrlParam(URL_PARAMS.saveAction);
    const dashboardContextFormData = getDashboardContextFormData();
    if (!isExploreInitialized.current || isSaveAction) {
      getExploreInitialData()
        .then(({ result }) => {
          const formData = getFormDataWithDashboardContext(
            result.form_data,
            dashboardContextFormData,
          );
          dispatch(
            hydrateExplore({
              ...result,
              form_data: formData,
            }),
          );
        })
        .catch(err => {
          dispatch(hydrateExplore(fallbackExploreInitialData));
          dispatch(addDangerToast(err.message));
        })
        .finally(() => {
          setIsLoaded(true);
          isExploreInitialized.current = true;
        });
    }
  }, []);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
}
