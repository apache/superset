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
import { useDispatch } from 'react-redux';
import { makeApi } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { getParsedExploreURLParams } from './exploreUtils/getParsedExploreURLParams';
import { hydrateExplore } from './actions/hydrateExplore';
import ExploreViewContainer from './components/ExploreViewContainer';

export const ExplorePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    const exploreUrlParams = getParsedExploreURLParams();
    const fetchExploreData = async () => {
      const response = await makeApi({
        method: 'GET',
        endpoint: 'api/v1/explore/',
      })(exploreUrlParams);
      dispatch(hydrateExplore(response.result));
      setIsLoaded(true);
    };
    fetchExploreData();
  }, []);

  if (!isLoaded) {
    return <Loading />;
  }
  return <ExploreViewContainer />;
};
