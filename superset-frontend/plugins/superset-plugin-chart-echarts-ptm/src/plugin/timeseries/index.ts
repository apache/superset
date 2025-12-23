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
import { createPtmPlugin } from '../../shared';
import thumbnail from './images/thumbnail.png';
import { 
  TIMESERIES_TRANSFORM_CONFIG, 
  timeseriesSeriesTypeControl,
  timeseriesZoomControl,
} from './timeseriesTransformConfig';
import { timeseriesPluginTransform } from './timeseriesPluginTransform';

import TimeseriesTransformProps from '@superset-ui/plugin-chart-echarts/Timeseries/transformProps';
import TimeseriesBuildQuery from '@superset-ui/plugin-chart-echarts/Timeseries/buildQuery';
import TimeseriesControlPanel from '@superset-ui/plugin-chart-echarts/Timeseries/Regular/Bar/controlPanel';
import EchartsTimeseries from '@superset-ui/plugin-chart-echarts/Timeseries/EchartsTimeseries';

import TIMESERIES_PTM_DEFAULTS from './defaults';

const PtmTimeseriesChartPlugin = createPtmPlugin({
  name: 'PTM Timeseries',
  description: 'Time-series chart with Portal Telemedicina styling, series type override, and customization options.',
  category: 'Evolution',
  tags: ['ECharts', 'Timeseries', 'Line', 'Bar', 'Temporal'],
  thumbnail,
  base: {
    buildQuery: TimeseriesBuildQuery,
    transformProps: TimeseriesTransformProps,
    controlPanel: TimeseriesControlPanel,
    Chart: EchartsTimeseries,
  },
  transforms: TIMESERIES_TRANSFORM_CONFIG,
  ptmDefaults: TIMESERIES_PTM_DEFAULTS,
  pluginTransform: timeseriesPluginTransform,
  additionalPtmControls: [
    timeseriesSeriesTypeControl,
    timeseriesZoomControl,
  ],
});

export default PtmTimeseriesChartPlugin;

export { default as PtmEchartsTimeseriesPlugin } from './index';
export { default as EchartsTimeseriesPtmChartPlugin } from './index';
