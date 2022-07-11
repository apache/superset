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
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isDefined, makeApi, SupersetClient, t } from '@superset-ui/core';
import { useLocation } from 'react-router-dom';
import Loading from 'src/components/Loading';
import pick from 'lodash/pick';
import { Dataset } from '@superset-ui/chart-controls';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';
import { addDangerToast } from '../components/MessageToasts/actions';
import { isNullish } from '../utils/common';
import { getUrlParam } from '../utils/urlUtils';
import { URL_PARAMS } from '../constants';
import { RootState } from '../dashboard/types';
import { Slice } from '../types/Chart';

const loadErrorMessage = t('Failed to load chart data.');

const fetchExploreData = () => {
  const exploreUrlParams = getParsedExploreURLParams();
  return makeApi<{}, ExploreResponsePayload>({
    method: 'GET',
    endpoint: 'api/v1/explore/',
  })(exploreUrlParams);
};

const useExploreInitialData = (
  shouldUseDashboardData: boolean,
  sliceId: string | null,
) => {
  const slice = useSelector<RootState, Slice | null>(({ sliceEntities }) =>
    isDefined(sliceId) ? sliceEntities?.slices?.[sliceId] : null,
  );
  const formData = slice?.form_data;
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
      !shouldUseDashboardData ||
      !isDefined(slice) ||
      !isDefined(formData) ||
      !isDefined(datasourceId) ||
      !isDefined(datasourceType)
    ) {
      return fetchExploreData();
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

const ExplorePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation<{ dashboardId?: number }>();

  const getExploreInitialData = useExploreInitialData(
    isDefined(location.state?.dashboardId),
    getUrlParam(URL_PARAMS.sliceId),
  );

  useEffect(() => {
    getExploreInitialData()
      .then(({ result }) => {
        if (isNullish(result.dataset?.id) && isNullish(result.dataset?.uid)) {
          dispatch(hydrateExplore(fallbackExploreInitialData));
          dispatch(addDangerToast(loadErrorMessage));
        } else {
          dispatch(hydrateExplore(result));
        }
      })
      .catch(() => {
        dispatch(hydrateExplore(fallbackExploreInitialData));
        dispatch(addDangerToast(loadErrorMessage));
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, [dispatch]);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
};

export default ExplorePage;
