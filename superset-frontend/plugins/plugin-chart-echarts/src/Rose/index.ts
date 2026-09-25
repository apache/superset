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
import example1 from './images/example1.jpg';
import example1Dark from './images/example1-dark.jpg';
import example2 from './images/example2.jpg';
import example2Dark from './images/example2-dark.jpg';
import { EchartsRoseFormData, EchartsRoseChartProps } from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsRoseChartPlugin extends EchartsChartPlugin<
  EchartsRoseFormData,
  EchartsRoseChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsRose'),
      metadata: {
        behaviors: [Behavior.InteractiveChart],
        category: t('Ranking'),
        description: t(
          'A polar coordinate chart where the circle is broken into wedges of equal angle, and the value represented by any wedge is illustrated by its area, rather than its radius or sweep angle. Click a wedge to expand its time period into a full pie.',
        ),
        exampleGallery: [
          { url: example1, urlDark: example1Dark },
          { url: example2, urlDark: example2Dark },
        ],
        name: t('Nightingale Rose Chart'),
        tags: [
          t('Advanced-Analytics'),
          t('Circular'),
          t('Multi-Layers'),
          t('Pattern'),
          t('Time'),
          t('Trend'),
          t('ECharts'),
        ],
        thumbnail,
        thumbnailDark,
      },
      transformProps,
    });
  }
}
