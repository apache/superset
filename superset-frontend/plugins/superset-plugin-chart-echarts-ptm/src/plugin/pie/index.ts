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
import { PIE_TRANSFORM_CONFIG } from './pieTransformConfig';
import thumbnail from './images/thumbnail.png';

import PieTransformProps from '@superset-ui/plugin-chart-echarts/Pie/transformProps';
import PieBuildQuery from '@superset-ui/plugin-chart-echarts/Pie/buildQuery';
import PieControlPanel from '@superset-ui/plugin-chart-echarts/Pie/controlPanel';
import EchartsPie from '@superset-ui/plugin-chart-echarts/Pie/EchartsPie';

import PIE_PTM_DEFAULTS from './defaults';

const PtmPieChartPlugin = createPtmPlugin({
  name: 'PTM Pie Chart',
  description: 'Pie/Donut chart with Portal Telemedicina styling and customization options.',
  category: 'Part of a Whole',
  tags: ['ECharts', 'Pie', 'Donut', 'Categorical'],
  thumbnail,
  base: {
    buildQuery: PieBuildQuery,
    transformProps: PieTransformProps,
    controlPanel: PieControlPanel,
    Chart: EchartsPie,
  },
  transforms: PIE_TRANSFORM_CONFIG,
  ptmDefaults: PIE_PTM_DEFAULTS,
});

export default PtmPieChartPlugin;
