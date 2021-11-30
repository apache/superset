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
import * as React from 'react';
import { SuperChart } from '@superset-ui/core';
import { radios } from '@storybook/addon-knobs';
import data from '../data/data';
import { SCATTER_PLOT_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export default () => (
  <SuperChart
    key="scatter-plot1"
    chartType={SCATTER_PLOT_PLUGIN_TYPE}
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        x: {
          field: 'sum__SP_RUR_TOTL_ZS',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            orient: radios(
              'x.axis.orient',
              { top: 'top', bottom: 'bottom' },
              'bottom',
            ),
          },
        },
        y: {
          field: 'sum__SP_DYN_LE00_IN',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            orient: radios(
              'y.axis.orient',
              { left: 'left', right: 'right' },
              'left',
            ),
          },
        },
        fill: {
          field: 'region',
          type: 'nominal',
          legend: true,
        },
        group: [{ field: 'country_name', title: 'Country' }],
      },
    }}
  />
);
