/**
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
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import {
  boolean,
  number,
  select,
  text,
  withKnobs,
} from '@storybook/addon-knobs';
import {
  EchartsBubbleChartPlugin,
  BubbleTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { simpleBubbleData } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsBubbleChartPlugin().configure({ key: 'bubble_v2' }).register();

getChartTransformPropsRegistry().registerValue(
  'bubble_v2',
  BubbleTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Bubble',
  decorators: [withKnobs, withResizableChartDemo],
};

export const SimpleBubble = ({ width, height }) => (
  <SuperChart
    chartType="bubble_v2"
    width={width}
    height={height}
    queriesData={[{ data: simpleBubbleData }]}
    formData={{
      entity: 'customer_name',
      x: 'count',
      y: {
        aggregate: 'SUM',
        column: {
          advanced_data_type: null,
          certification_details: null,
          certified_by: null,
          column_name: 'price_each',
          description: null,
          expression: null,
          filterable: true,
          groupby: true,
          id: 570,
          is_certified: false,
          is_dttm: false,
          python_date_format: null,
          type: 'DOUBLE PRECISION',
          type_generic: 0,
          verbose_name: null,
          warning_markdown: null,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: false,
        isNew: false,
        label: 'SUM(price_each)',
        optionName: 'metric_d9rpclvys0a_fs4bs0m2l1f',
        sqlExpression: null,
      },
      adhocFilters: [],
      size: {
        aggregate: 'SUM',
        column: {
          advanced_data_type: null,
          certification_details: null,
          certified_by: null,
          column_name: 'sales',
          description: null,
          expression: null,
          filterable: true,
          groupby: true,
          id: 571,
          is_certified: false,
          is_dttm: false,
          python_date_format: null,
          type: 'DOUBLE PRECISION',
          type_generic: 0,
          verbose_name: null,
          warning_markdown: null,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: false,
        isNew: false,
        label: 'SUM(sales)',
        optionName: 'metric_itj9wncjxk_dp3yibib0q',
        sqlExpression: null,
      },
      limit: 10,
      colorScheme: 'supersetColors',
      maxBubbleSize: select('Max bubble size', [5, 10, 25, 50, 100, 125], 10),
      xAxisTitle: text('X axis title', ''),
      xAxisTitleMargin: number('X axis title margin', 30),
      yAxisTitle: text('Y axis title', ''),
      yAxisTitleMargin: number('Y axis title margin', 30),
      yAxisTitlePosition: 'Left',
      xAxisFormat: null,
      logYAxis: boolean('Log Y axis', false),
      yAxisFormat: null,
      logXAxis: boolean('Log X axis', false),
      truncateYAxis: false,
      yAxisBounds: [],
      extraFormData: {},
    }}
  />
);
