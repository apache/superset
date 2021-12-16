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

/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';
import data from './data';

new TreemapChartPlugin().configure({ key: 'treemap' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-treemap',
};

export const basic = () => (
  <SuperChart
    chartType="treemap"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      numberFormat: '.3s',
      treeMapRatio: 1.618033988749895,
    }}
  />
);
