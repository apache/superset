(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import AreaChartPlugin from './Area';
import BarChartPlugin from './Bar';
import BoxPlotChartPlugin from './BoxPlot';
import BubbleChartPlugin from './Bubble';
import BulletChartPlugin from './Bullet';
import CompareChartPlugin from './Compare';
import DistBarChartPlugin from './DistBar';
import DualLineChartPlugin from './DualLine';
import LineChartPlugin from './Line';
import LineMultiChartPlugin from './LineMulti';
import PieChartPlugin from './Pie';
import TimePivotChartPlugin from './TimePivot';

export default class NVD3ChartPreset extends Preset {
  constructor() {
    super({
      name: 'NVD3 charts',
      plugins: [
      new AreaChartPlugin().configure({ key: 'area' }),
      new BarChartPlugin().configure({ key: 'bar' }),
      new BoxPlotChartPlugin().configure({ key: 'box_plot' }),
      new BubbleChartPlugin().configure({ key: 'bubble' }),
      new BulletChartPlugin().configure({ key: 'bullet' }),
      new CompareChartPlugin().configure({ key: 'compare' }),
      new DistBarChartPlugin().configure({ key: 'dist_bar' }),
      new DualLineChartPlugin().configure({ key: 'dual_line' }),
      new LineChartPlugin().configure({ key: 'line' }),
      new LineMultiChartPlugin().configure({ key: 'line_multi' }),
      new PieChartPlugin().configure({ key: 'pie' }),
      new TimePivotChartPlugin().configure({ key: 'time_pivot' })] });


  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(NVD3ChartPreset, "NVD3ChartPreset", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/preset.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();