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
import { PivotTableChartPlugin } from '@superset-ui/plugin-chart-pivot-table';
import { basicFormData, basicData } from './testData';
import { withResizableChartDemo } from '@storybook-shared';

export default {
  title: 'Chart Plugins/plugin-chart-pivot-table',
  decorators: [withResizableChartDemo],
  args: {
    rowOrder: 'key_a_to_z',
    colOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: false,
    combineMetric: false,
    rowSubtotalPosition: 'after',
    colSubtotalPosition: 'after',
  },
  argTypes: {
    rowOrder: {
      control: 'select',
      options: ['key_a_to_z', 'key_z_to_a', 'value_a_to_z', 'value_z_to_a'],
      description: 'Row sorting order',
    },
    colOrder: {
      control: 'select',
      options: ['key_a_to_z', 'key_z_to_a', 'value_a_to_z', 'value_z_to_a'],
      description: 'Column sorting order',
    },
    aggregateFunction: {
      control: 'select',
      options: ['Sum', 'Count', 'Average', 'Median', 'Minimum', 'Maximum'],
    },
    transposePivot: {
      control: 'boolean',
      description: 'Swap rows and columns',
    },
    combineMetric: {
      control: 'boolean',
      description: 'Combine metrics into single column',
    },
    rowSubtotalPosition: {
      control: 'select',
      options: ['before', 'after'],
    },
    colSubtotalPosition: {
      control: 'select',
      options: ['before', 'after'],
    },
  },
};

new PivotTableChartPlugin().configure({ key: VizType.PivotTable }).register();

export const Basic = ({
  width,
  height,
  rowOrder,
  colOrder,
  aggregateFunction,
  transposePivot,
  combineMetric,
  rowSubtotalPosition,
  colSubtotalPosition,
}: {
  width: number;
  height: number;
  rowOrder: string;
  colOrder: string;
  aggregateFunction: string;
  transposePivot: boolean;
  combineMetric: boolean;
  rowSubtotalPosition: string;
  colSubtotalPosition: string;
}) => (
  <SuperChart
    chartType={VizType.PivotTable}
    datasource={{
      columnFormats: {},
    }}
    width={width}
    height={height}
    queriesData={[basicData]}
    formData={{
      ...basicFormData,
      row_order: rowOrder,
      col_order: colOrder,
      aggregate_function: aggregateFunction,
      transpose_pivot: transposePivot,
      combine_metric: combineMetric,
      row_subtotal_position: rowSubtotalPosition,
      col_subtotal_position: colSubtotalPosition,
    }}
  />
);
Basic.parameters = {
  initialSize: {
    width: 680,
    height: 420,
  },
};
