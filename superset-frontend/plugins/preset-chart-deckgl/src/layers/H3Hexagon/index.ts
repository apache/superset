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
import { ChartMetadata, ChartPlugin, Behavior } from '@superset-ui/core';
import { t } from '@apache-superset/core';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';
import buildQuery from './buildQuery';
import transformProps from './transformProps';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Map'),
  credits: ['https://deck.gl/docs/api-reference/geo-layers/h3-hexagon-layer'],
  description: t(
    'Visualize geospatial data using H3 hexagonal indexing system with optional elevation',
  ),
  name: t('deck.gl H3 Hexagon'),
  thumbnail,
  thumbnailDark,
  exampleGallery: [{ url: example, urlDark: exampleDark }],
  tags: [
    t('deckGL'),
    t('Geo'),
    t('H3'),
    t('Hexagon'),
    t('3D'),
    t('Spatial Index'),
  ],
  behaviors: [Behavior.InteractiveChart],
});

export default class H3HexagonChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('./H3Hexagon'),
      controlPanel,
      metadata,
      transformProps,
    });
  }
}
