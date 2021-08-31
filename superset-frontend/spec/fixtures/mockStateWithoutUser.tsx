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
import datasources from 'spec/fixtures/mockDatasource';
import messageToasts from 'spec/javascripts/messageToasts/mockMessageToasts';
import {
  nativeFiltersInfo,
  mockDataMaskInfo,
} from 'spec/javascripts/dashboard/fixtures/mockNativeFilters';
import chartQueries from 'spec/fixtures/mockChartQueries';
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import dashboardInfo from 'spec/fixtures/mockDashboardInfo';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import dashboardState from 'spec/fixtures/mockDashboardState';
import { sliceEntitiesForChart } from 'spec/fixtures/mockSliceEntities';
import reports from 'spec/fixtures/mockReportState';

export default {
  datasources,
  sliceEntities: sliceEntitiesForChart,
  charts: chartQueries,
  nativeFilters: nativeFiltersInfo,
  dataMask: mockDataMaskInfo,
  dashboardInfo,
  dashboardFilters: emptyFilters,
  dashboardState,
  dashboardLayout,
  messageToasts,
  impressionId: 'mock_impression_id',
  reports,
};
