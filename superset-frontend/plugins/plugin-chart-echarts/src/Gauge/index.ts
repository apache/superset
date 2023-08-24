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
import { t, Behavior } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.jpg';
import example2 from './images/example2.jpg';
import buildQuery from './buildQuery';
import { EchartsGaugeChartProps, EchartsGaugeFormData } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsGaugeChartPlugin extends EchartsChartPlugin<
  EchartsGaugeFormData,
  EchartsGaugeChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsGauge'),
      metadata: {
        behaviors: [
          Behavior.INTERACTIVE_CHART,
          Behavior.DRILL_TO_DETAIL,
          Behavior.DRILL_BY,
        ],
        category: t('KPI'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Uses a gauge to showcase progress of a metric towards a target. The position of the dial represents the progress and the terminal value in the gauge represents the target value.',
        ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        name: t('Gauge Chart'),
        tags: [
          t('Multi-Variables'),
          t('Business'),
          t('Comparison'),
          t('ECharts'),
          t('Report'),
        ],
        thumbnail,
      },
      transformProps,
    });
  }
}
