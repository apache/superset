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
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { isDefined, JsonObject, makeApi, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';
import { getItem, LocalStorageKeys } from '../utils/localStorageHelpers';
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

const getDashboardPageContext = (pageId?: string | null) => {
  if (!pageId) {
    return null;
  }
  return (
    getItem(LocalStorageKeys.dashboard__explore_context, {})[pageId] || null
  );
};

const getDashboardContextFormData = () => {
  const dashboardPageId = getUrlParam(URL_PARAMS.dashboardPageId);
  const dashboardContext = getDashboardPageContext(dashboardPageId);
  if (dashboardContext) {
    const sliceId = getUrlParam(URL_PARAMS.sliceId) || 0;
    const {
      labelColors,
      sharedLabelColors,
      colorScheme,
      chartConfiguration,
      nativeFilters,
      filterBoxFilters,
      dataMask,
      dashboardId,
    } = dashboardContext;
    const dashboardContextWithFilters = getFormDataWithExtraFilters({
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

export default function ExplorePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const isExploreInitialized = useRef(false);
  const dispatch = useDispatch();
  const location = useLocation();

  useEffect(() => {
    const exploreUrlParams = getParsedExploreURLParams(location);
    const isSaveAction = !!getUrlParam(URL_PARAMS.saveAction);
    const dashboardContextFormData = getDashboardContextFormData();
    if (!isExploreInitialized.current || isSaveAction) {
      fetchExploreData(exploreUrlParams)
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
  }, [dispatch, location]);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
}
