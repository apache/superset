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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from './transformProps';
import controlPanel from './controlPanel';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  category: t('Correlation'),
  credits: ['https://github.com/wa0x6e/cal-heatmap'],
  description: t(
    "Visualizes how a metric has changed over a time using a color scale and a calendar view. Gray values are used to indicate missing values and the linear color scheme is used to encode the magnitude of each day's value.",
  ),
  name: t('Calendar Heatmap'),
  tags: [
    t('Business'),
    t('Comparison'),
    t('Intensity'),
    t('Pattern'),
    t('Report'),
    t('Trend'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class CalendarChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactCalendar'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
