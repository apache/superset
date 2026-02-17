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
import ArcChartPlugin from './layers/Arc';
import GeoJsonChartPlugin from './layers/Geojson';
import GridChartPlugin from './layers/Grid';
import HexChartPlugin from './layers/Hex';
import HeatmapChartPlugin from './layers/Heatmap';
import MultiChartPlugin from './Multi';
import PathChartPlugin from './layers/Path';
import PolygonChartPlugin from './layers/Polygon';
import ScatterChartPlugin from './layers/Scatter';
import ScreengridChartPlugin from './layers/Screengrid';
import ContourChartPlugin from './layers/Contour';

export default class DeckGLChartPreset extends Preset {
  constructor() {
    super({
      name: 'deck.gl charts',
      plugins: [
        new ArcChartPlugin().configure({ key: 'deck_arc_maplibre' }),
        new GeoJsonChartPlugin().configure({ key: 'deck_geojson_maplibre' }),
        new GridChartPlugin().configure({ key: 'deck_grid_maplibre' }),
        new HexChartPlugin().configure({ key: 'deck_hex_maplibre' }),
        new HeatmapChartPlugin().configure({ key: 'deck_heatmap_maplibre' }),
        new MultiChartPlugin().configure({ key: 'deck_multi_maplibre' }),
        new PathChartPlugin().configure({ key: 'deck_path_maplibre' }),
        new PolygonChartPlugin().configure({ key: 'deck_polygon_maplibre' }),
        new ScatterChartPlugin().configure({ key: 'deck_scatter_maplibre' }),
        new ScreengridChartPlugin().configure({
          key: 'deck_screengrid_maplibre',
        }),
        new ContourChartPlugin().configure({ key: 'deck_contour_maplibre' }),
      ],
    });
  }
}
