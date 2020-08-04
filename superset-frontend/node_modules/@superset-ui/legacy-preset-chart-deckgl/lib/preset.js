"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

var _Arc = _interopRequireDefault(require("./layers/Arc"));

var _Geojson = _interopRequireDefault(require("./layers/Geojson"));

var _Grid = _interopRequireDefault(require("./layers/Grid"));

var _Hex = _interopRequireDefault(require("./layers/Hex"));

var _Multi = _interopRequireDefault(require("./Multi"));

var _Path = _interopRequireDefault(require("./layers/Path"));

var _Polygon = _interopRequireDefault(require("./layers/Polygon"));

var _Scatter = _interopRequireDefault(require("./layers/Scatter"));

var _Screengrid = _interopRequireDefault(require("./layers/Screengrid"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
class DeckGLChartPreset extends _core.Preset {
  constructor() {
    super({
      name: 'deck.gl charts',
      plugins: [new _Arc.default().configure({
        key: 'deck_arc'
      }), new _Geojson.default().configure({
        key: 'deck_geojson'
      }), new _Grid.default().configure({
        key: 'deck_grid'
      }), new _Hex.default().configure({
        key: 'deck_hex'
      }), new _Multi.default().configure({
        key: 'deck_multi'
      }), new _Path.default().configure({
        key: 'deck_path'
      }), new _Polygon.default().configure({
        key: 'deck_polygon'
      }), new _Scatter.default().configure({
        key: 'deck_scatter'
      }), new _Screengrid.default().configure({
        key: 'deck_screengrid'
      })]
    });
  }

}

exports.default = DeckGLChartPreset;