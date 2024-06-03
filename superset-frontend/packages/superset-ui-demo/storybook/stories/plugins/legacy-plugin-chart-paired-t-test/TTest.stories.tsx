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
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import data from './data';

new PairedTTestChartPlugin().configure({ key: 'paired-t-test' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-paired-t-test',
};

export const basic = () => (
  <SuperChart
    chartType="paired-t-test"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      groupby: ['name'],
      liftvaluePrecision: 4,
      metrics: ['sum__num'],
      pvaluePrecision: 6,
      significanceLevel: 0.05,
    }}
  />
);
