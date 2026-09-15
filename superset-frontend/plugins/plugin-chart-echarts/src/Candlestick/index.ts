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
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example1.png';
import exampleDark from './images/example1-dark.png';
import {
  EchartsCandlestickChartProps,
  EchartsCandlestickFormData,
} from './types';
import { EchartsChartPlugin } from '../types';

export default class EchartsCandlestickChartPlugin extends EchartsChartPlugin<
  EchartsCandlestickFormData,
  EchartsCandlestickChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsCandlestick'),
      metadata: {
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'A candlestick chart shows opening, closing, high, and low values for each period. It is commonly used for financial and other time-series range analysis.',
        ),
        exampleGallery: [{ url: example, urlDark: exampleDark }],
        name: t('Candlestick Chart'),
        tags: [
          t('ECharts'),
          t('Financial'),
          t('Range'),
          t('Time'),
          t('Featured'),
        ],
        thumbnail,
        thumbnailDark,
      },
      transformProps,
    });
  }
}
