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
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="v2-box-plot"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        x: {
          type: 'nominal',
          field: 'label',
          scale: {
            type: 'band',
            paddingInner: 0.15,
            paddingOuter: 0.3,
          },
          axis: {
            label: 'Region',
          },
        },
        y: {
          field: 'value',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            label: 'Population',
            numTicks: 5,
          },
        },
        color: {
          type: 'nominal',
          field: 'label',
          scale: {
            scheme: 'd3Category10',
          },
        },
      },
    }}
  />
);

export const horizontal = () => (
  <SuperChart
    chartType="v2-box-plot"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        y: {
          type: 'nominal',
          field: 'label',
          scale: {
            type: 'band',
            paddingInner: 0.15,
            paddingOuter: 0.3,
          },
          axis: {
            label: 'Region',
          },
        },
        x: {
          field: 'value',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            label: 'Population',
            numTicks: 5,
          },
        },
        color: {
          type: 'nominal',
          field: 'label',
          scale: {
            scheme: 'd3Category10',
          },
        },
      },
    }}
  />
);
