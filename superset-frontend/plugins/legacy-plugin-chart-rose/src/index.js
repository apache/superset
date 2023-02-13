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
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.jpg';
import example2 from './images/example2.jpg';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Ranking'),
  description: t(
    'A polar coordinate chart where the circle is broken into wedges of equal angle, and the value represented by any wedge is illustrated by its area, rather than its radius or sweep angle.',
  ),
  exampleGallery: [{ url: example1 }, { url: example2 }],
  name: t('Nightingale Rose Chart'),
  tags: [
    t('Legacy'),
    t('Advanced-Analytics'),
    t('Circular'),
    t('Multi-Layers'),
    t('Pattern'),
    t('Time'),
    t('Trend'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class RoseChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactRose'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
