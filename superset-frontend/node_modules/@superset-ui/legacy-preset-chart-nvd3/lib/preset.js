"use strict";

exports.__esModule = true;
exports.default = void 0;

var _core = require("@superset-ui/core");

var _Area = _interopRequireDefault(require("./Area"));

var _Bar = _interopRequireDefault(require("./Bar"));

var _BoxPlot = _interopRequireDefault(require("./BoxPlot"));

var _Bubble = _interopRequireDefault(require("./Bubble"));

var _Bullet = _interopRequireDefault(require("./Bullet"));

var _Compare = _interopRequireDefault(require("./Compare"));

var _DistBar = _interopRequireDefault(require("./DistBar"));

var _DualLine = _interopRequireDefault(require("./DualLine"));

var _Line = _interopRequireDefault(require("./Line"));

var _LineMulti = _interopRequireDefault(require("./LineMulti"));

var _Pie = _interopRequireDefault(require("./Pie"));

var _TimePivot = _interopRequireDefault(require("./TimePivot"));

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
class NVD3ChartPreset extends _core.Preset {
  constructor() {
    super({
      name: 'NVD3 charts',
      plugins: [new _Area.default().configure({
        key: 'area'
      }), new _Bar.default().configure({
        key: 'bar'
      }), new _BoxPlot.default().configure({
        key: 'box_plot'
      }), new _Bubble.default().configure({
        key: 'bubble'
      }), new _Bullet.default().configure({
        key: 'bullet'
      }), new _Compare.default().configure({
        key: 'compare'
      }), new _DistBar.default().configure({
        key: 'dist_bar'
      }), new _DualLine.default().configure({
        key: 'dual_line'
      }), new _Line.default().configure({
        key: 'line'
      }), new _LineMulti.default().configure({
        key: 'line_multi'
      }), new _Pie.default().configure({
        key: 'pie'
      }), new _TimePivot.default().configure({
        key: 'time_pivot'
      })]
    });
  }

}

exports.default = NVD3ChartPreset;