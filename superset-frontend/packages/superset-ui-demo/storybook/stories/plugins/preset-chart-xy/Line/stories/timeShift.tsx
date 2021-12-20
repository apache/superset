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
import { SuperChart } from '@superset-ui/core';
import data from '../data/data2';
import { LINE_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export default () => (
  <SuperChart
    key="line1"
    chartType={LINE_PLUGIN_TYPE}
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        x: {
          field: 'x',
          type: 'temporal',
          format: '%Y',
          scale: {
            type: 'time',
          },
          axis: {
            orient: 'bottom',
            title: 'Time',
          },
        },
        y: {
          field: 'y',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            orient: 'left',
            title: 'Score',
          },
        },
        stroke: {
          value: '#1abc9c',
          type: 'nominal',
          scale: false,
        },
        fill: {
          field: 'snapshot',
          type: 'nominal',
          scale: {
            type: 'ordinal',
            domain: ['Current', 'Last year'],
            range: [true, false],
          },
          legend: false,
        },
        strokeDasharray: {
          field: 'snapshot',
          type: 'nominal',
          scale: {
            type: 'ordinal',
            domain: ['Current', 'Last year'],
            range: [null, '4 4'],
          },
          legend: false,
        },
        strokeWidth: {
          field: 'snapshot',
          type: 'nominal',
          scale: {
            type: 'ordinal',
            domain: ['Current', 'Last year'],
            range: [3, 1.5],
          },
          legend: false,
        },
      },
    }}
  />
);
