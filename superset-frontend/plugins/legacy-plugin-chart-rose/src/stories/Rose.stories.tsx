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
import { SuperChart, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import data from './data';
import { withResizableChartDemo } from '@storybook-shared';

new RoseChartPlugin().configure({ key: VizType.Rose }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-rose',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    numberFormat: '.3s',
    dateTimeFormat: '%Y-%m-%d',
    richTooltip: true,
    roseAreaProportion: false,
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
    numberFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s', ',d'],
    },
    dateTimeFormat: {
      control: 'select',
      options: ['%Y-%m-%d', '%Y-%m-%d %H:%M', '%b %d, %Y', '%d/%m/%Y'],
    },
    richTooltip: { control: 'boolean' },
    roseAreaProportion: {
      control: 'boolean',
      description:
        'When true, area is proportional to value; when false, radius is proportional',
    },
  },
};

export const Basic = ({
  width,
  height,
  colorScheme,
  numberFormat,
  dateTimeFormat,
  richTooltip,
  roseAreaProportion,
}: {
  width: number;
  height: number;
  colorScheme: string;
  numberFormat: string;
  dateTimeFormat: string;
  richTooltip: boolean;
  roseAreaProportion: boolean;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VizType.Rose}
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      date_time_format: dateTimeFormat,
      number_format: numberFormat,
      rich_tooltip: richTooltip,
      rose_area_proportion: roseAreaProportion,
    }}
  />
);
