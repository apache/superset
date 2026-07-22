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
import { t } from '@apache-superset/core/translation';
import { Behavior } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { EchartsCandlestickChartProps, CandlestickQueryFormData } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsCandlestickChartPlugin extends EchartsChartPlugin<
  CandlestickQueryFormData,
  EchartsCandlestickChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsCandlestick'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        category: t('Financial'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Candlestick charts are used to visualize price movements of a financial instrument over time. They show the open, close, high, and low prices for each period.',
        ),
        name: t('Candlestick Chart'),
        tags: [
          t('ECharts'),
          t('Financial'),
          t('Trend'),
          t('Featured'),
        ],
        thumbnail,
      },
      transformProps,
    });
  }
}
