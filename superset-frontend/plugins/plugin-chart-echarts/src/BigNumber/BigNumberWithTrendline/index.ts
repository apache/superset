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
import { t, ChartMetadata, ChartPlugin, Behavior } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import example from './images/Big_Number_Trendline.jpg';
import thumbnail from './images/thumbnail.png';
import {
  BigNumberWithTrendlineChartProps,
  BigNumberWithTrendlineFormData,
} from '../types';

const metadata = new ChartMetadata({
  category: t('KPI'),
  description: t(
    'Showcases a single number accompanied by a simple line chart, to call attention to an important metric along with its change over time or other dimension.',
  ),
  exampleGallery: [{ url: example }],
  name: t('Big Number with Trendline'),
  tags: [
    t('Advanced-Analytics'),
    t('Line'),
    t('Percentages'),
    t('Popular'),
    t('Report'),
    t('Description'),
    t('Trend'),
  ],
  thumbnail,
  behaviors: [Behavior.DRILL_TO_DETAIL],
});

export default class BigNumberWithTrendlineChartPlugin extends ChartPlugin<
  BigNumberWithTrendlineFormData,
  BigNumberWithTrendlineChartProps
> {
  constructor() {
    super({
      loadChart: () => import('../BigNumberViz'),
      metadata,
      buildQuery,
      transformProps,
      controlPanel,
    });
  }
}
