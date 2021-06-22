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
  category: t('Distribution'),
  credits: ['http://nvd3.org'],
  description: t(
    'A time series chart that visualizes how the proportions of related metrics vary over time.',
  ),
  exampleGallery: [
    { url: example1, caption: t('Stretched style') },
    { url: example2, caption: t('Stacked style') },
    { url: example3, caption: t('Video game consoles') },
    { url: example4, caption: t('Cars') },
  ],
  name: t('Area Chart'),
  supportedAnnotationTypes: [ANNOTATION_TYPES.INTERVAL, ANNOTATION_TYPES.EVENT],
  tags: [t('Time Series'), t('Proportions')],
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
