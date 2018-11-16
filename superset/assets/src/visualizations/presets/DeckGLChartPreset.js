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
import { Preset } from '@superset-ui/core';
import ArcChartPlugin from '../deckgl/layers/Arc/ArcChartPlugin';
import GeoJsonChartPlugin from '../deckgl/layers/Geojson/GeojsonChartPlugin';
import GridChartPlugin from '../deckgl/layers/Grid/GridChartPlugin';
import HexChartPlugin from '../deckgl/layers/Hex/HexChartPlugin';
import KeplerChartPlugin from '../Kepler/KeplerChartPlugin';
import MultiChartPlugin from '../deckgl/Multi/MultiChartPlugin';
import PathChartPlugin from '../deckgl/layers/Path/PathChartPlugin';
import PolygonChartPlugin from '../deckgl/layers/Polygon/PolygonChartPlugin';
import ScatterChartPlugin from '../deckgl/layers/Scatter/ScatterChartPlugin';
import ScreengridChartPlugin from '../deckgl/layers/Screengrid/ScreengridChartPlugin';

export default class DeckGLChartPreset extends Preset {
  constructor() {
    super({
      name: 'deck.gl charts',
      plugins: [
        new ArcChartPlugin().configure({ key: 'deck_arc' }),
        new GeoJsonChartPlugin().configure({ key: 'deck_geojson' }),
        new GridChartPlugin().configure({ key: 'deck_grid' }),
        new HexChartPlugin().configure({ key: 'deck_hex' }),
        new KeplerChartPlugin().configure({ key: 'kepler' }),
        new MultiChartPlugin().configure({ key: 'deck_multi' }),
        new PathChartPlugin().configure({ key: 'deck_path' }),
        new PolygonChartPlugin().configure({ key: 'deck_polygon' }),
        new ScatterChartPlugin().configure({ key: 'deck_scatter' }),
        new ScreengridChartPlugin().configure({ key: 'deck_screengrid' }),
      ],
    });
  }
}
