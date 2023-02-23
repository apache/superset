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

import { DataMaskStateWithId } from '@superset-ui/core';
import { DashboardInfo, DashboardLayout } from 'src/dashboard/types';
import { CrossFilterIndicator, selectChartCrossFilters } from '../../selectors';

export const crossFiltersSelector = (props: {
  dataMask: DataMaskStateWithId;
  dashboardInfo: DashboardInfo;
  dashboardLayout: DashboardLayout;
}): CrossFilterIndicator[] => {
  const { dataMask, dashboardInfo, dashboardLayout } = props;
  const chartConfiguration = dashboardInfo.metadata?.chart_configuration;
  const chartsIds = Object.keys(chartConfiguration);
  const shouldFilterEmitters = true;

  let selectedCrossFilters: CrossFilterIndicator[] = [];

  for (let i = 0; i < chartsIds.length; i += 1) {
    const chartId = Number(chartsIds[i]);
    const crossFilters = selectChartCrossFilters(
      dataMask,
      chartId,
      dashboardLayout,
      chartConfiguration,
      shouldFilterEmitters,
    );
    selectedCrossFilters = [
      ...selectedCrossFilters,
      ...(crossFilters as CrossFilterIndicator[]),
    ];
  }
  return selectedCrossFilters;
};

export default crossFiltersSelector;
