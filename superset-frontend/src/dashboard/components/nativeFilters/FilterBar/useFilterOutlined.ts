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

import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from 'src/dashboard/types';
import getChartAndLabelComponentIdFromPath from 'src/dashboard/util/getChartAndLabelComponentIdFromPath';

const filterOutlinedSelector = createSelector(
  [
    (state: RootState) => state.dashboardState.directPathToChild,
    (state: RootState) => state.dashboardState.directPathLastUpdated,
  ],
  (directPathToChild, directPathLastUpdated) => ({
    outlinedFilterId: (
      getChartAndLabelComponentIdFromPath(directPathToChild || []) as Record<
        string,
        string
      >
    )?.native_filter,
    lastUpdated: directPathLastUpdated,
  }),
);
export const useFilterOutlined = () =>
  useSelector<RootState, { outlinedFilterId: string; lastUpdated: number }>(
    filterOutlinedSelector,
  );
