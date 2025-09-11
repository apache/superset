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

import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="bubble"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      annotationData: {},
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      entity: 'country_name',
      leftMargin: 'auto',
      maxBubbleSize: '50',
      series: 'region',
      showLegend: true,
      size: 'sum__SP_POP_TOTL',
      vizType: 'bubble',
      x: 'sum__SP_RUR_TOTL_ZS',
      xAxisFormat: '.3s',
      xAxisLabel: 'x-axis label',
      xAxisShowminmax: false,
      xLogScale: false,
      xTicksLayout: 'auto',
      y: 'sum__SP_DYN_LE00_IN',
      yAxisFormat: '.3s',
      yAxisLabel: '',
      yAxisShowminmax: false,
      yLogScale: false,
    }}
  />
);
