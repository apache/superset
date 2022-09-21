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
import { NativeFilterScope } from '@superset-ui/core';
import { CHART_TYPE } from './componentTypes';
import { ChartsState, Layout } from '../types';

export function getChartIdsInFilterScope(
  filterScope: NativeFilterScope,
  charts: ChartsState,
  layout: Layout,
) {
  const layoutItems = Object.values(layout);
  return Object.values(charts)
    .filter(
      chart =>
        !filterScope.excluded.includes(chart.id) &&
        layoutItems
          .find(
            layoutItem =>
              layoutItem?.type === CHART_TYPE &&
              layoutItem.meta?.chartId === chart.id,
          )
          ?.parents?.some(elementId =>
            filterScope.rootPath.includes(elementId),
          ),
    )
    .map(chart => chart.id);
}
