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
import example from './images/example.jpg';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Correlation'),
  credits: ['http://nvd3.org'],
  description: t(
    'Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.',
  ),
  exampleGallery: [{ url: example }],
  label: ChartLabel.Deprecated,
  name: t('Bubble Chart (legacy)'),
  tags: [
    t('Multi-Dimensions'),
    t('Comparison'),
    t('Legacy'),
    t('Scatter'),
    t('Time'),
    t('Trend'),
    t('nvd3'),
  ],
  thumbnail,
  useLegacyApi: true,
});

/**
 * @deprecated in version 4.0.
 */
export default class BubbleChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../ReactNVD3'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
