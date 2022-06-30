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
import { makeApi, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';
import { ExplorePageState, ExploreResponsePayload } from './types';
import { fallbackExploreInitialData } from './fixtures';
import { addDangerToast } from '../components/MessageToasts/actions';
import { isNullish } from '../utils/common';

const loadErrorMessage = t('Failed to load chart data.');

export const ExplorePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const defaultVizType = useSelector<ExplorePageState, string>(
    state => state.common?.conf.DEFAULT_VIZ_TYPE || 'table',
  );
  const dispatch = useDispatch();

  useEffect(() => {
    const exploreUrlParams = getParsedExploreURLParams();
    const fetchExploreData = async () => {
      makeApi<{}, ExploreResponsePayload>({
        method: 'GET',
        endpoint: 'api/v1/explore/',
      })(exploreUrlParams)
        .then(({ result }) => {
          if (!result.form_data.viz_type) {
            Object.assign(result.form_data, {
              viz_type: exploreUrlParams.get('viz_type') || defaultVizType,
            });
          }
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
    };
    fetchExploreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
};
