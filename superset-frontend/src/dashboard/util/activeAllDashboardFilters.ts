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
import { CHART_TYPE } from './componentTypes';
import { Scope } from '../components/nativeFilters/types';
import { ActiveFilters, LayoutItem } from '../types';
import { ChartConfiguration, Filters } from '../reducers/types';
import { DASHBOARD_ROOT_ID } from './constants';
import { DataMaskStateWithId } from '../../dataMask/types';

// Looking for affected chart scopes and values
export const findAffectedCharts = ({
  child,
  layout,
  scope,
  activeFilters,
  filterId,
  extraFormData,
}: {
  child: string;
  layout: { [key: string]: LayoutItem };
  scope: Scope;
  activeFilters: ActiveFilters;
  filterId: string;
  extraFormData: any;
}) => {
  const chartId = layout[child]?.meta?.chartId;
  if (layout[child].type === CHART_TYPE) {
    // Ignore excluded charts
    if (scope.excluded.includes(chartId)) {
      return;
    }
    if (!activeFilters[filterId]) {
      // Small mutation but simplify logic
      // eslint-disable-next-line no-param-reassign
      activeFilters[filterId] = {
        scope: [],
        values: [],
      };
    }
    // Add not excluded chart scopes(to know what charts refresh) and values(refresh only if its value changed)
    activeFilters[filterId].scope.push(chartId);
    activeFilters[filterId].values.push(extraFormData);
    return;
  }
  // If child is not chart, recursive iterate over its children
  layout[child].children.forEach((child: string) =>
    findAffectedCharts({
      child,
      layout,
      scope,
      activeFilters,
      filterId,
      extraFormData,
    }),
  );
};

export const getAllActiveFilters = ({
  chartConfiguration,
  nativeFilters,
  dataMask,
  layout,
}: {
  chartConfiguration: ChartConfiguration;
  dataMask: DataMaskStateWithId;
  nativeFilters: Filters;
  layout: { [key: string]: LayoutItem };
}): ActiveFilters => {
  const activeFilters = {};

  // Combine native filters with cross filters, because they have similar logic
  Object.values({
    ...dataMask.nativeFilters,
    ...dataMask.crossFilters,
  }).forEach(({ id: filterId, extraFormData }) => {
    const scope = nativeFilters?.[filterId]?.scope ??
      chartConfiguration?.[filterId]?.crossFilters?.scope ?? {
        rootPath: [DASHBOARD_ROOT_ID],
        excluded: [filterId],
      };
    // Iterate over all roots to find all affected charts
    scope.rootPath.forEach(layoutItemId => {
      layout[layoutItemId].children.forEach((child: string) => {
        // Need exclude from affected charts, charts that located in scope `excluded`
        findAffectedCharts({
          child,
          layout,
          scope,
          activeFilters,
          filterId,
          extraFormData,
        });
      });
    });
  });
  return activeFilters;
};
