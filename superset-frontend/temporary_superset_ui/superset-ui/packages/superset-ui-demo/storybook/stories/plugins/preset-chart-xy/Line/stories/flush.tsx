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
import { radios } from '@storybook/addon-knobs';
import rawData from '../data/data';
import { LINE_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

const MIN_TIME = new Date(Date.UTC(1980, 0, 1)).getTime();
const MAX_TIME = new Date(Date.UTC(2000, 1, 1)).getTime();
const data = rawData.filter(({ x }) => x >= MIN_TIME && x <= MAX_TIME);

export default () => (
  <>
    <SuperChart
      key="line1"
      chartType={LINE_PLUGIN_TYPE}
      width={400}
      height={200}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        encoding: {
          x: {
            field: 'x',
            type: 'temporal',
            format: '%Y',
            scale: {
              type: 'utc',
            },
            axis: {
              tickCount: 6,
              orient: radios(
                'x.axis.orient',
                { top: 'top', bottom: 'bottom' },
                'bottom',
              ),
              title: radios(
                'x.axis.title',
                { enable: 'Time', disable: '', '': undefined },
                'Time',
              ),
            },
          },
          y: {
            field: 'y',
            type: 'quantitative',
            scale: {
              type: 'linear',
            },
            axis: {
              tickCount: 3,
              orient: radios(
                'y.axis.orient',
                { left: 'left', right: 'right', '': undefined },
                'left',
              ),
              title: radios(
                'y.axis.title',
                { enable: 'Score', disable: '', '': undefined },
                'Score',
              ),
            },
          },
          stroke: {
            field: 'name',
            type: 'nominal',
            legend: true,
          },
        },
      }}
    />
    ,
    <SuperChart
      key="line2"
      chartType={LINE_PLUGIN_TYPE}
      width={400}
      height={200}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        encoding: {
          x: {
            field: 'x',
            type: 'temporal',
            format: '%Y',
            scale: {
              type: 'utc',
            },
            axis: {
              labelFlush: 5,
              tickCount: 6,
              orient: radios(
                'x.axis.orient',
                { top: 'top', bottom: 'bottom' },
                'bottom',
              ),
              title: radios(
                'x.axis.title',
                { enable: 'Time', disable: '', '': undefined },
                'Time',
              ),
            },
          },
          y: {
            field: 'y',
            type: 'quantitative',
            scale: {
              type: 'linear',
            },
            axis: {
              tickCount: 3,
              orient: radios(
                'y.axis.orient',
                { left: 'left', right: 'right', '': undefined },
                'left',
              ),
              title: radios(
                'y.axis.title',
                { enable: 'Score', disable: '', '': undefined },
                'Score',
              ),
            },
          },
          stroke: {
            field: 'name',
            type: 'nominal',
            legend: true,
          },
        },
      }}
    />
  </>
);
