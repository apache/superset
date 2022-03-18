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
import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import dashboardInfo from 'src/dashboard/reducers/dashboardInfo';
import dashboardState from 'src/dashboard/reducers/dashboardState';
import dashboardFilters from 'src/dashboard/reducers/dashboardFilters';
import nativeFilters from 'src/dashboard/reducers/nativeFilters';
import datasources from 'src/dashboard/reducers/datasources';
import sliceEntities from 'src/dashboard/reducers/sliceEntities';
import dashboardLayout from 'src/dashboard/reducers/undoableDashboardLayout';
import messageToasts from 'src/components/MessageToasts/reducers';
import saveModal from 'src/explore/reducers/saveModalReducer';
import explore from 'src/explore/reducers/exploreReducer';
import sqlLab from 'src/SqlLab/reducers/sqlLab';
import localStorageUsageInKilobytes from 'src/SqlLab/reducers/localStorageUsage';
import reports from 'src/reports/reducers/reports';

const impressionId = (state = '') => state;

const container = document.getElementById('app');
const bootstrap = JSON.parse(container?.getAttribute('data-bootstrap') ?? '{}');
const common = { ...bootstrap.common };

export default {
  charts,
  datasources,
  dashboardInfo,
  dashboardFilters,
  dataMask,
  nativeFilters,
  dashboardState,
  dashboardLayout,
  impressionId,
  messageToasts,
  sliceEntities,
  saveModal,
  explore,
  sqlLab,
  localStorageUsageInKilobytes,
  reports,
  common: () => common,
};
