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
import example1 from './images/Bar_Chart.jpg';
import example2 from './images/Bar_Chart_2.jpg';
import example3 from './images/BarChart3.jpg';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Ranking'),
  credits: ['http://nvd3.org'],
  description: t(
    'Compares metrics from different categories using bars. Bar lengths are used to indicate the magnitude of each value and color is used to differentiate groups.',
  ),
  exampleGallery: [
    { url: example1, caption: 'Stacked style' },
    { url: example2, caption: 'Grouped style' },
    { url: example3 },
  ],
  label: ChartLabel.Deprecated,
  name: t('Bar Chart (legacy)'),
  tags: [
    t('Additive'),
    t('Bar'),
    t('Categorical'),
    t('Comparison'),
    t('Legacy'),
    t('Percentages'),
    t('Stacked'),
    t('nvd3'),
  ],
  thumbnail,
  useLegacyApi: true,
});

/**
 * @deprecated in version 3.0.
 */
export default class DistBarChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('../ReactNVD3'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
