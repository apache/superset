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
import transportation from './images/transportation.jpg';
import channels from './images/channels.jpg';
import employment from './images/employment.jpg';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Correlation'),
  credits: ['http://bl.ocks.org/mbostock/3074470'],
  description: t(
    'Visualize a related metric across pairs of groups. Heatmaps excel at showcasing the correlation or strength between two groups. Color is used to emphasize the strength of the link between each pair of groups.',
  ),
  exampleGallery: [
    { url: transportation, caption: t('Sizes of vehicles') },
    { url: channels, caption: t('Relationships between community channels') },
    { url: employment, caption: t('Employment and education') },
  ],
  name: t('Heatmap'),
  tags: [t('Business'), t('Intensity'), t('Legacy'), t('Highly-used'), t('Predictive')],
  thumbnail,
  useLegacyApi: true,
});

export default class HeatmapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactHeatmap.js'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
