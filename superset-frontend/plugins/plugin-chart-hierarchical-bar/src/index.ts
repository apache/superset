/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { DrilldownBarFormData, BarChartTransformedProps } from './types';

// This is the modern syntax. It exports the class directly.
export default class HierarchicalBarChartPlugin extends ChartPlugin<
  DrilldownBarFormData,
  BarChartTransformedProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./DrilldownBarChart'),
      metadata: new ChartMetadata({
        description: t(
          'A Bar Chart that supports both click-to-drill-down and the native Drill By context menu.',
        ),
        name: t('Hierarchical Bar Chart'),
        thumbnail,
        credits: ['RMC'],
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
          Behavior.NativeFilter,
        ],
        category: t('Part of a Whole'),
        tags: [
          t('Categorical'),
          t('Drilldown'),
          t('Hierarchical'),
          t('Bar'),
          t('ECharts'),
        ],
      }),
      transformProps,
    });
  }
}
