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
import TimeTableChartPlugin from '@superset-ui/legacy-plugin-chart-time-table';
import data from './data';

new TimeTableChartPlugin().configure({ key: 'time-table' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-time-table',
};

export const basic = () => (
  <SuperChart
    chartType="time-table"
    width={400}
    height={400}
    queriesData={[
      {
        data: {
          columns: [
            'East Asia & Pacific',
            'Latin America & Caribbean',
            'Middle East & North Africa',
            'Sub-Saharan Africa',
          ],
          records: data,
        },
      },
    ]}
    formData={{
      adhocFilters: [],
      groupby: ['region'],
      columnCollection: [
        {
          bounds: [null, null],
          colType: 'spark',
          comparisonType: '',
          d3format: '',
          dateFormat: '',
          height: '',
          key: '0vFMepUDf',
          label: 'Time Series Columns',
          showYAxis: false,
          timeLag: 0,
          timeRatio: '',
          tooltip: '',
          width: '',
          yAxisBounds: [null, null],
        },
      ],
      vizType: 'time-table',
    }}
  />
);
