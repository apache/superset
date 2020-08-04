"use strict";

exports.__esModule = true;
exports.default = void 0;

var _Grid = require("./Grid/Grid");

var _Screengrid = require("./Screengrid/Screengrid");

var _Path = require("./Path/Path");

var _Hex = require("./Hex/Hex");

var _Scatter = require("./Scatter/Scatter");

var _Geojson = require("./Geojson/Geojson");

var _Arc = require("./Arc/Arc");

var _Polygon = require("./Polygon/Polygon");

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
const layerGenerators = {
  deck_grid: _Grid.getLayer,
  deck_screengrid: _Screengrid.getLayer,
  deck_path: _Path.getLayer,
  deck_hex: _Hex.getLayer,
  deck_scatter: _Scatter.getLayer,
  deck_geojson: _Geojson.getLayer,
  deck_arc: _Arc.getLayer,
  deck_polygon: _Polygon.getLayer
};
var _default = layerGenerators;
exports.default = _default;