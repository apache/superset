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
import example1 from './images/Sankey.jpg';
import example2 from './images/Sankey2.jpg';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Flow'),
  credits: ['https://github.com/d3/d3-sankey'],
  description: t(
    "Visualizes the flow of different group's values through different stages of a system. New stages in the pipeline are visualized as nodes or layers. The thickness of the bars or edges represent the metric being visualized.",
  ),
  exampleGallery: [
    { url: example1, description: t('Demographics') },
    { url: example2, description: t('Survey Responses') },
  ],
  name: t('Sankey Diagram'),
  tags: [
    t('Categorical'),
    t('Directional'),
    t('Legacy'),
    t('Percentages'),
    t('Proportional'),
    t('Relational'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class SankeyChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactSankey'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
