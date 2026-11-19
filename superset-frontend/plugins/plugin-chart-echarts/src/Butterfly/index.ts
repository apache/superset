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
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import { EchartsButterflyChartProps, EchartsButterflyFormData } from './types';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

export default class EchartsButterflyChartPlugin extends ChartPlugin<
  EchartsButterflyFormData,
  EchartsButterflyChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./Butterfly'),
      metadata: new ChartMetadata({
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        credits: ['https://echarts.apache.org'],
        category: t('Comparison'),
        description: t(
          'A butterfly chart compares two metrics across categories using horizontal bars ' +
            'that extend left and right from a central axis.',
        ),
        exampleGallery: [{ url: example, urlDark: exampleDark }],
        name: t('Butterfly Chart'),
        tags: [
          t('Categorical'),
          t('Comparison'),
          t('ECharts'),
          t('Multi-Variables'),
        ],
        thumbnail,
        thumbnailDark,
      }),
      transformProps,
    });
  }
}
