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
import AreaChartPlugin from './Area';
import BarChartPlugin from './Bar';
import BoxPlotChartPlugin from './BoxPlot';
import BubbleChartPlugin from './Bubble';
import BulletChartPlugin from './Bullet';
import CompareChartPlugin from './Compare';
import DistBarChartPlugin from './DistBar';
import LineChartPlugin from './Line';
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
        new LineChartPlugin().configure({ key: 'line' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        new TimePivotChartPlugin().configure({ key: 'time_pivot' }),
      ],
    });
  }
}
