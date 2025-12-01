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
import { isEmpty } from 'lodash';
import type { AgGridChartState } from '@superset-ui/core';

/**
 * Determines the initial filter model for AG Grid
 * Priority: chartState.filterModel > serverPaginationData.agGridFilterModel
 *
 * @param chartState - Saved chart state from permalink (can be partial)
 * @param serverPaginationData - Server pagination data containing filter model
 * @param serverPagination - Whether server pagination is enabled
 * @returns Filter model object or undefined if no valid filter exists
 */
const getInitialFilterModel = (
  chartState?: Partial<AgGridChartState>,
  serverPaginationData?: Record<string, any>,
  serverPagination?: boolean,
): Record<string, any> | undefined => {
  // Use chartState.filterModel if it exists and is not empty
  const chartStateFilterModel =
    chartState?.filterModel && !isEmpty(chartState.filterModel)
      ? chartState.filterModel
      : undefined;

  // Use serverPaginationData.agGridFilterModel if server pagination is enabled and it's not empty
  const serverFilterModel =
    serverPagination &&
    serverPaginationData?.agGridFilterModel &&
    !isEmpty(serverPaginationData.agGridFilterModel)
      ? serverPaginationData.agGridFilterModel
      : undefined;

  // Return chartState filter model first, fallback to server filter model
  return chartStateFilterModel || serverFilterModel;
};

export default getInitialFilterModel;
