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
import { BigNumberChartPlugin, BigNumberTotalChartPlugin } from '@superset-ui/legacy-preset-chart-big-number';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import { AreaChartPlugin, BarChartPlugin, BoxPlotChartPlugin, BubbleChartPlugin, DistBarChartPlugin, LineChartPlugin, PieChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import PivotTableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';
import TableChartPlugin from '@superset-ui/legacy-plugin-chart-table';
import WordCloudChartPlugin from '@superset-ui/legacy-plugin-chart-word-cloud';
// import BubbleChartPlugin from '../nvd3/Bubble/BubbleChartPlugin';
import FilterBoxChartPlugin from '../FilterBox/FilterBoxChartPlugin';
import TimeTableChartPlugin from '../TimeTable/TimeTableChartPlugin';

export default class CommonChartPreset extends Preset {
  constructor() {
    super({
      name: 'Common charts',
      plugins: [
        new AreaChartPlugin().configure({ key: 'area' }),
        new BarChartPlugin().configure({ key: 'bar' }),
        new BigNumberChartPlugin().configure({ key: 'big_number' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        new BoxPlotChartPlugin().configure({ key: 'box_plot' }),
        new BubbleChartPlugin().configure({ key: 'bubble' }),
        new DistBarChartPlugin().configure({ key: 'dist_bar' }),
        new FilterBoxChartPlugin().configure({ key: 'filter_box' }),
        new HistogramChartPlugin().configure({ key: 'histogram' }),
        new LineChartPlugin().configure({ key: 'line' }),
        new PieChartPlugin().configure({ key: 'pie' }),
        new PivotTableChartPlugin().configure({ key: 'pivot_table' }),
        new TableChartPlugin().configure({ key: 'table' }),
        new TimeTableChartPlugin().configure({ key: 'time_table' }),
        new WordCloudChartPlugin().configure({ key: 'word_cloud' }),
      ],
    });
  }
}
