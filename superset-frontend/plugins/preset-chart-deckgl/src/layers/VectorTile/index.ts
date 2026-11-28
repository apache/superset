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

import { t } from '@apache-superset/core/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Map'),
  credits: ['https://deck.gl'],
  description: t(
    'Draws vector tiles (MVT) fetched directly from a tile server. Only the tiles visible on screen are loaded.',
  ),
  name: t('deck.gl Vector Tiles'),
  thumbnail,
  thumbnailDark,
  tags: [t('deckGL'), t('2D')],
});

export default class VectorTileChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./VectorTile'),
      loadTransformProps: () => import('./transformProps'),
      loadBuildQuery: () => import('./buildQuery'),
      controlPanel,
      metadata,
    });
  }
}
