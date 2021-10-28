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
import data from '../data/legacyData';
import { LINE_PLUGIN_LEGACY_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export default () => (
  <>
    <SuperChart
      key="line1"
      chartType={LINE_PLUGIN_LEGACY_TYPE}
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        bottomMargin: 'auto',
        colorScheme: 'd3Category10',
        leftMargin: 'auto',
        lineInterpolation: 'linear',
        richTooltip: true,
        showBrush: 'auto',
        showLegend: true,
        showMarkers: false,
        vizType: 'line',
        xAxisFormat: '%Y',
        xAxisLabel: '',
        xAxisShowminmax: false,
        xTicksLayout: 'auto',
        yAxisBounds: [null, null],
        yAxisFormat: '',
        yAxisLabel: '',
        yAxisShowminmax: false,
        yLogScale: false,
      }}
    />
    ,
    <SuperChart
      key="line2"
      chartType={LINE_PLUGIN_LEGACY_TYPE}
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        bottomMargin: 'auto',
        colorScheme: 'd3Category10',
        leftMargin: 'auto',
        lineInterpolation: 'linear',
        richTooltip: true,
        showBrush: 'auto',
        showLegend: true,
        showMarkers: false,
        vizType: 'line',
        xAxisFormat: '%Y-%m',
        xAxisLabel: '',
        xAxisShowminmax: false,
        xTicksLayout: 'auto',
        yAxisBounds: [null, null],
        yAxisFormat: '',
        yAxisLabel: '',
        yAxisShowminmax: false,
        yLogScale: false,
      }}
    />
  </>
);
