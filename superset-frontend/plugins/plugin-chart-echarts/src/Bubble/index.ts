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
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import example1 from './images/example1.png';
import example2 from './images/example2.png';
import { EchartsBubbleChartProps, EchartsBubbleFormData } from './types';

export default class EchartsBubbleChartPlugin extends ChartPlugin<
  EchartsBubbleFormData,
  EchartsBubbleChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsBubble'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Correlation'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.',
        ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        name: t('Bubble Chart'),
        tags: [
          t('Multi-Dimensions'),
          t('Aesthetic'),
          t('Comparison'),
          t('Scatter'),
          t('Time'),
          t('Trend'),
          t('ECharts'),
        ],
        thumbnail,
      }),
      transformProps,
    });
  }
}
