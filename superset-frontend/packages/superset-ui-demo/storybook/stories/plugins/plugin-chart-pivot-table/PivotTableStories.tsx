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

import React from 'react';
import { withKnobs } from '@storybook/addon-knobs';
import { SuperChart } from '@superset-ui/core';
import { PivotTableChartPlugin } from '@superset-ui/plugin-chart-pivot-table';
import { basicFormData, basicData } from './testData';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

export default {
  title: 'Chart Plugins/plugin-chart-pivot-table',
  decorators: [withKnobs, withResizableChartDemo],
};

new PivotTableChartPlugin().configure({ key: 'pivot_table_v2' }).register();

export const basic = ({ width, height }) => (
  <SuperChart
    chartType="pivot_table_v2"
    datasource={{
      columnFormats: {},
    }}
    width={width}
    height={height}
    queriesData={[basicData]}
    formData={basicFormData}
  />
);
basic.story = {
  parameters: {
    initialSize: {
      width: 680,
      height: 420,
    },
  },
};

export const MaximumAggregation = ({ width, height }) => (
  <SuperChart
    chartType="pivot_table_v2"
    datasource={{
      columnFormats: {},
    }}
    width={width}
    height={height}
    queriesData={[basicData]}
    formData={{ ...basicFormData, aggregateFunction: 'Maximum' }}
  />
);
basic.story = {
  parameters: {
    initialSize: {
      width: 680,
      height: 420,
    },
  },
};
