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

/* eslint-disable no-magic-numbers */
import { SuperChart } from '@superset-ui/core';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import data from './data';

new HistogramChartPlugin().configure({ key: 'histogram' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-histogram',
};

export const basic = () => (
  <SuperChart
    chartType="histogram"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      globalOpacity: 1,
      linkLength: 15, // binCount
      normalized: false,
      xAxisLabel: 'Score',
      yAxisLabel: 'Count',
    }}
  />
);
