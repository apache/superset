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
import example1 from './images/Treemap.jpg';
import example2 from './images/Treemap2.jpg';
import example3 from './images/Treemap3.jpg';
import example4 from './images/Treemap4.jpg';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Part of a Whole'),
  credits: ['https://bl.ocks.org/mbostock/911ad09bdead40ec0061'],
  description: t(
    'Shows the composition of a dataset by segmenting a given rectangle as smaller rectangles with areas proportional to their value or contribution to the whole. Those rectangles may also, in turn, be further segmented hierarchically.',
  ),
  exampleGallery: [
    { url: example1 },
    { url: example2 },
    { url: example3 },
    { url: example4 },
  ],
  name: t('Treemap'),
  tags: [
    t('Categorical'),
    t('Legacy'),
    t('Multi-Levels'),
    t('Percentages'),
    t('Proportional'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class TreemapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactTreemap'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
