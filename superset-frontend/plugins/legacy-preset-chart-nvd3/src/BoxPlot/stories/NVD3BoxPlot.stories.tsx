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

import { SuperChart, VizType } from '@superset-ui/core';
import { EchartsBoxPlotChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';
import data from './data';

new EchartsBoxPlotChartPlugin().configure({ key: 'box-plot' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-nvd3/BoxPlot',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    whiskerOptions: 'Min/max (no outliers)',
  },
  argTypes: {
    colorScheme: {
      control: 'select',
      options: [
        'supersetColors',
        'd3Category10',
        'bnbColors',
        'googleCategory20c',
      ],
    },
    whiskerOptions: {
      control: 'select',
      options: [
        'Tukey',
        'Min/max (no outliers)',
        '2/98 percentiles',
        '9/91 percentiles',
      ],
    },
  },
};

export const Basic = ({
  colorScheme,
  whiskerOptions,
  width,
  height,
}: {
  colorScheme: string;
  whiskerOptions: string;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType="box-plot"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      viz_type: VizType.BoxPlot,
      whisker_options: whiskerOptions,
      groupby: ['region'],
      metrics: ['sum__SP_POP_TOTL'],
    }}
  />
);
