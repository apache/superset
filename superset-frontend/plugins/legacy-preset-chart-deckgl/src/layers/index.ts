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
/* eslint camelcase: 0 */
import { getLayer as deck_grid } from './Grid/Grid';
import { getLayer as deck_screengrid } from './Screengrid/Screengrid';
import { getLayer as deck_path } from './Path/Path';
import { getLayer as deck_hex } from './Hex/Hex';
import { getLayer as deck_scatter } from './Scatter/Scatter';
import { getLayer as deck_geojson } from './Geojson/Geojson';
import { getLayer as deck_arc } from './Arc/Arc';
import { getLayer as deck_polygon } from './Polygon/Polygon';
import { getLayer as deck_heatmap } from './Heatmap/Heatmap';
import { getLayer as deck_contour } from './Contour/Contour';

const layerGenerators = {
  deck_grid,
  deck_screengrid,
  deck_path,
  deck_hex,
  deck_scatter,
  deck_geojson,
  deck_arc,
  deck_polygon,
  deck_heatmap,
  deck_contour,
};

export default layerGenerators;
