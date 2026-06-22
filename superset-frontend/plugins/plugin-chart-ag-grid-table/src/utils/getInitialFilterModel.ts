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

const getInitialFilterModel = (
  chartState?: Partial<AgGridChartState>,
  serverPaginationData?: Record<string, unknown>,
  serverPagination?: boolean,
): Record<string, unknown> | undefined => {
  const chartStateFilterModel =
    chartState?.filterModel && !isEmpty(chartState.filterModel)
      ? (chartState.filterModel as Record<string, unknown>)
      : undefined;

  const serverFilterModel =
    serverPagination &&
    serverPaginationData?.agGridFilterModel &&
    !isEmpty(serverPaginationData.agGridFilterModel)
      ? (serverPaginationData.agGridFilterModel as Record<string, unknown>)
      : undefined;

  return chartStateFilterModel ?? serverFilterModel;
};

export default getInitialFilterModel;
