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
import {
  makeApi,
  t,
  isDefined,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { Slice } from 'src/types/Chart';
import { Dataset } from '@superset-ui/chart-controls';
import Loading from 'src/components/Loading';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';

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

const fetchExploreData = async (exploreUrlParams: URLSearchParams) => {
  try {
    const rv = await makeApi<{}, ExploreResponsePayload>({
      method: 'GET',
      endpoint: 'api/v1/explore/',
    })(exploreUrlParams);
    if (isResult(rv)) {
      return rv;
    }
    throw Error(loadErrorMessage);
  } catch (err) {
    throw Error(err);
  }
};

const ExplorePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const isExploreInitialized = useRef(false);
  const dispatch = useDispatch();
  const location = useLocation();

  useEffect(() => {
    const exploreUrlParams = getParsedExploreURLParams(location);
    const isSaveAction = !!getUrlParam(URL_PARAMS.saveAction);
    if (!isExploreInitialized.current || isSaveAction) {
      fetchExploreData(exploreUrlParams)
        .then(({ result }) => {
          dispatch(hydrateExplore(result));
        })
        .catch(() => {
          dispatch(hydrateExplore(fallbackExploreInitialData));
          dispatch(addDangerToast(loadErrorMessage));
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
};

export default ExplorePage;
