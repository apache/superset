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
import { t } from '@superset-ui/translation';

import { getDashboardFilterKey } from './getDashboardFilterKey';
import { ALL_FILTERS_ROOT } from './constants';
import { DASHBOARD_ROOT_TYPE } from './componentTypes';

export default function getFilterFieldNodesTree({ dashboardFilters = {} }) {
  const allFilters = Object.values(dashboardFilters).map(dashboardFilter => {
    const { chartId, filterName, columns, labels } = dashboardFilter;
    const children = Object.keys(columns).map(column => ({
      value: getDashboardFilterKey({ chartId, column }),
      label: labels[column] || column,
    }));
    return {
      value: chartId,
      label: filterName,
      children,
      showCheckbox: true,
    };
  });

  return [
    {
      value: ALL_FILTERS_ROOT,
      type: DASHBOARD_ROOT_TYPE,
      label: t('All filters'),
      children: allFilters,
    },
  ];
}
