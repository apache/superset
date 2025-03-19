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
import {
  EchartsBubbleChartPlugin,
  BubbleTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { simpleBubbleData } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsBubbleChartPlugin().configure({ key: 'bubble_v2' }).register();

getChartTransformPropsRegistry().registerValue(
  'bubble_v2',
  BubbleTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts',
  decorators: [withResizableChartDemo],
  args: {
    maxBubbleSize: 10,
    xAxisTitle: '',
    xAxisTitleMargin: 30,
    yAxisTitle: '',
    yAxisTitleMargin: 30,
    logYAxis: false,
    logXAxis: false,
  },
  argTypes: {
    maxBubbleSize: {
      control: 'select',
      options: [5, 10, 25, 50, 100, 125],
      name: 'Max Bubble Size',
      description: 'Maximum size of bubbles',
    },
    xAxisTitle: {
      control: 'text',
      name: 'X Axis Title',
      description: 'Title for the X axis',
    },
    xAxisTitleMargin: {
      control: 'number',
      name: 'X Axis Title Margin',
      description: 'Margin for the X axis title',
    },
    yAxisTitle: {
      control: 'text',
      name: 'Y Axis Title',
      description: 'Title for the Y axis',
    },
    yAxisTitleMargin: {
      control: 'number',
      name: 'Y Axis Title Margin',
      description: 'Margin for the Y axis title',
    },
    logYAxis: {
      control: 'boolean',
      name: 'Log Y Axis',
      description: 'Whether to use a logarithmic scale for the Y axis',
    },
    logXAxis: {
      control: 'boolean',
      name: 'Log X Axis',
      description: 'Whether to use a logarithmic scale for the X axis',
    },
  },
};

export const BubbleChart = (
  {
    maxBubbleSize,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisTitle,
    yAxisTitleMargin,
    logYAxis,
    logXAxis,
  }: {
    maxBubbleSize: number;
    xAxisTitle: string;
    xAxisTitleMargin: number;
    yAxisTitle: string;
    yAxisTitleMargin: number;
    logYAxis: boolean;
    logXAxis: boolean;
  },
  { width, height }: { width: number; height: number },
) => (
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
      maxBubbleSize,
      xAxisTitle,
      xAxisTitleMargin,
      yAxisTitle,
      yAxisTitleMargin,
      yAxisTitlePosition: 'Left',
      xAxisFormat: null,
      logYAxis,
      yAxisFormat: null,
      logXAxis,
      truncateYAxis: false,
      yAxisBounds: [],
      extraFormData: {},
    }}
  />
);
