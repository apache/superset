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
import transformProps from '../transformProps';
import example1 from './images/example1.jpg';
import example2 from './images/example2.jpg';
import example3 from './images/example3.jpg';
import example4 from './images/example4.jpg';
import thumbnail from './images/thumbnail.png';
import { ANNOTATION_TYPES } from '../vendor/superset/AnnotationTypes';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Evolution'),
  credits: ['http://nvd3.org'],
  description: t(
    'A time series chart that visualizes how a related metric from multiple groups vary over time. Each group is visualized using a different color.',
  ),
  exampleGallery: [
    { url: example1, caption: t('Stretched style') },
    { url: example2, caption: t('Stacked style') },
    { url: example3, caption: t('Video game consoles') },
    { url: example4, caption: t('Vehicle Types') },
  ],
  name: t('Area Chart (legacy)'),
  supportedAnnotationTypes: [ANNOTATION_TYPES.INTERVAL, ANNOTATION_TYPES.EVENT],
  tags: [
    t('Aesthetic'),
    t('Comparison'),
    t('Continuous'),
    t('Legacy'),
    t('Line'),
    t('Percentages'),
    t('Proportional'),
    t('Stacked'),
    t('Time'),
    t('Trend'),
    t('nvd3'),
    t('Deprecated'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class AreaChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../ReactNVD3'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
