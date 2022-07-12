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
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  makeApi,
  t,
  isDefined,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { Slice } from 'src/types/Chart';
import { Dataset } from '@superset-ui/chart-controls';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import { getDatasource } from './actions/datasourcesActions';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';
import { addDangerToast } from '../components/MessageToasts/actions';
import { getUrlParam } from '../utils/urlUtils';
import { URL_PARAMS } from '../constants';
import { RootState } from '../dashboard/types';

const loadErrorMessage = t('Failed to load chart data.');

interface ResultInterface {
  result: {
    form_data: QueryFormData;
    slice: Slice;
    dataset: Dataset;
  };
}

const isResult = (rv: JsonObject): rv is ResultInterface =>
  rv?.result?.form_data &&
  rv?.result?.slice &&
  rv?.result?.dataset &&
  isDefined(rv?.result?.dataset?.id) &&
  isDefined(rv?.result?.dataset?.uid);

const fetchExploreData = async (
  rootState: RootState,
  sliceId: string | null,
): Promise<ResultInterface> => {
  if (sliceId && rootState?.sliceEntities?.slices?.[sliceId]) {
    // explore page from Dashboard
    const slice = rootState?.sliceEntities?.slices?.[sliceId];
    const form_data = slice?.form_data;
    // const dataset = rootState?.datasources?.[form_data?.datasource];
    let dataset: Dataset;
    try {
      const [datasourcePK] = form_data?.datasource?.split('__');
      dataset = await getDatasource(datasourcePK);
    } catch (err) {
      throw new Error(err);
    }

    const rv = {
      result: {
        form_data,
        slice,
        dataset,
      },
    };
    if (isResult(rv)) {
      return rv;
    }
  }

  try {
    const rv = await makeApi<{}, ExploreResponsePayload>({
      method: 'GET',
      endpoint: 'api/v1/explore/',
    })(getParsedExploreURLParams());
    if (isResult(rv)) {
      return rv;
    }
    throw loadErrorMessage;
  } catch (err) {
    throw new Error(err);
  }
};

const ExplorePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const dispatch = useDispatch();
  const rootState = useSelector(state => state) as RootState;
  const sliceId = getUrlParam(URL_PARAMS.sliceId);

  useEffect(() => {
    fetchExploreData(rootState, sliceId)
      .then(({ result }) => {
        dispatch(hydrateExplore(result));
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
