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
import { t, ChartMetadata, ChartPlugin, ChartLabel } from '@superset-ui/core';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Time_Series_Bar_Chart.jpg';
import example2 from './images/Time_Series_Bar_Chart2.jpg';
import example3 from './images/Time_Series_Bar_Chart3.jpg';
import { ANNOTATION_TYPES } from '../vendor/superset/AnnotationTypes';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Evolution'),
  credits: ['http://nvd3.org'],
  description: t(
    'Visualize how a metric changes over time using bars. Add a group by column to visualize group level metrics and how they change over time.',
  ),
  exampleGallery: [{ url: example1 }, { url: example2 }, { url: example3 }],
  label: ChartLabel.DEPRECATED,
  name: t('Time-series Bar Chart (legacy)'),
  supportedAnnotationTypes: [ANNOTATION_TYPES.INTERVAL, ANNOTATION_TYPES.EVENT],
  tags: [
    t('Bar'),
    t('Time'),
    t('Trend'),
    t('Stacked'),
    t('Vertical'),
    t('Percentages'),
    t('Proportional'),
    t('Advanced-Analytics'),
    t('nvd3'),
    t('Legacy'),
    t('Deprecated'),
  ],
  thumbnail,
  useLegacyApi: true,
});

/**
 * @deprecated in version 3.0.
 */
export default class BarChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../ReactNVD3'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
