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
import example1 from './images/example1.jpg';
import example2 from './images/example2.jpg';
import example3 from './images/example3.jpg';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Distribution'),
  description: t(
    'Take your data points, and group them into "bins" to see where the densest areas of information lie',
  ),
  exampleGallery: [
    { url: example1, caption: t('Population age data') },
    { url: example2 },
    { url: example3 },
  ],
  name: t('Histogram (legacy)'),
  tags: [t('Comparison'), t('Legacy'), t('Pattern'), t('Range')],
  thumbnail,
  useLegacyApi: true,
});

export default class HistogramChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./Histogram'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
