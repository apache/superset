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
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';
import { EchartsTimePivotFormData, EchartsTimePivotChartProps } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsTimePivotChartPlugin extends EchartsChartPlugin<
  EchartsTimePivotFormData,
  EchartsTimePivotChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsTimePivot'),
      metadata: {
        behaviors: [Behavior.InteractiveChart],
        category: t('Evolution'),
        description: t(
          'Compares the current time period against equivalent past periods by overlaying them on a shared time axis. The current period is drawn boldly while prior periods fade with age.',
        ),
        exampleGallery: [{ url: example, urlDark: exampleDark }],
        name: t('Time-series Period Pivot'),
        tags: [t('Comparison'), t('Time'), t('Trend'), t('ECharts')],
        thumbnail,
        thumbnailDark,
      },
      transformProps,
    });
  }
}
