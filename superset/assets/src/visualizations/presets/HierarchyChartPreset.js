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
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import SunburstChartPlugin from '@superset-ui/legacy-plugin-chart-sunburst';
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';

export default class HierarchyChartPreset extends Preset {
  constructor() {
    super({
      name: 'Hierarchy charts',
      plugins: [
        new PartitionChartPlugin().configure({ key: 'partition' }),
        new SunburstChartPlugin().configure({ key: 'sunburst' }),
        new TreemapChartPlugin().configure({ key: 'treemap' }),
      ],
    });
  }
}
