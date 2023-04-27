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

import {
  DataMaskStateWithId,
  getColumnLabel,
  isDefined,
  JsonObject,
} from '@superset-ui/core';
import { DashboardLayout } from 'src/dashboard/types';
import { CrossFilterIndicator, getCrossFilterIndicator } from '../../selectors';

export const crossFiltersSelector = (props: {
  dataMask: DataMaskStateWithId;
  chartConfiguration: JsonObject;
  dashboardLayout: DashboardLayout;
  verboseMaps: { [key: string]: Record<string, string> };
}): CrossFilterIndicator[] => {
  const { dataMask, chartConfiguration, dashboardLayout, verboseMaps } = props;
  const chartsIds = Object.keys(chartConfiguration);

  return chartsIds
    .map(chartId => {
      const id = Number(chartId);
      const filterIndicator = getCrossFilterIndicator(
        id,
        dataMask[id],
        dashboardLayout,
      );
      if (
        isDefined(filterIndicator.column) &&
        isDefined(filterIndicator.value)
      ) {
        const verboseColName =
          verboseMaps[id]?.[getColumnLabel(filterIndicator.column)] ||
          filterIndicator.column;
        return { ...filterIndicator, column: verboseColName, emitterId: id };
      }
      return null;
    })
    .filter(Boolean) as CrossFilterIndicator[];
};

export default crossFiltersSelector;
