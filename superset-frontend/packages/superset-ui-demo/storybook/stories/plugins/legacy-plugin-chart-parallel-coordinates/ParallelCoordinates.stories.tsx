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

import { SuperChart } from '@superset-ui/core';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import data from './data';

new ParallelCoordinatesChartPlugin()
  .configure({ key: 'parallel-coordinates' })
  .register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-parallel-coordinates',
};

export const basic = () => (
  <SuperChart
    chartType="parallel-coordinates"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      includeSeries: false,
      linearColorScheme: 'schemeRdYlBu',
      metrics: ['sum__SP_POP_TOTL', 'sum__SP_RUR_TOTL_ZS', 'sum__SH_DYN_AIDS'],
      secondaryMetric: 'sum__SP_POP_TOTL',
      series: 'country_name',
      showDatatable: false,
    }}
  />
);
