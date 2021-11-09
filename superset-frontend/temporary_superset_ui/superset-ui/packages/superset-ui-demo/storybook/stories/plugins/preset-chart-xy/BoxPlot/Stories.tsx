/*
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

import {
  BoxPlotChartPlugin,
  LegacyBoxPlotChartPlugin,
} from '@superset-ui/preset-chart-xy';
import { BOX_PLOT_PLUGIN_LEGACY_TYPE, BOX_PLOT_PLUGIN_TYPE } from './constants';

new LegacyBoxPlotChartPlugin()
  .configure({ key: BOX_PLOT_PLUGIN_LEGACY_TYPE })
  .register();
new BoxPlotChartPlugin().configure({ key: BOX_PLOT_PLUGIN_TYPE }).register();

export default {
  title: 'Chart Plugins/preset-chart-xy/BoxPlot',
};

export { basic, horizontal } from './stories/Basic';
export { legacy } from './stories/Legacy';
