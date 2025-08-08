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
import { rankWith, isControl, and } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  MetricsControl,
  MetricControl,
  AdhocFiltersControl,
  GroupByControl,
  ColumnsControl,
  ColorSchemeControl,
  LinearColorSchemeControl,
  RowLimitControl,
  SortByMetricControl,
  TimeRangeControl,
  TimeGrainSqlaControl,
  VizTypeControl,
  DatasourceControl,
  ColorPickerControl,
  CurrencyFormatControl,
  YAxisFormatControl,
  XAxisControl,
  SeriesControl,
  EntityControl,
  SecondaryMetricControl,
  TooltipColumnsControl,
  TooltipMetricsControl,
} from './SharedControlComponents';
import { ControlHeader } from '../../components/ControlHeader';

/**
 * Helper to create a renderer for a Superset control
 */
const createSupersetControlRenderer = (
  controlType: string,
  ControlComponent: () => any,
) => {
  const Renderer = (props: any) => {
    const { schema, uischema, visible } = props;

    if (!visible) {
      return null;
    }

    const control = ControlComponent();
    const label = uischema.label || schema.title;
    const { description } = schema;

    return (
      <div style={{ marginBottom: '16px' }}>
        {label && <ControlHeader label={label} description={description} />}
        <div>
          {/* Render the control configuration */}
          {control.config.type}
          {/* This would actually render the real control component */}
        </div>
      </div>
    );
  };

  return withJsonFormsControlProps(Renderer);
};

/**
 * Tester to check if a control is a specific Superset control type
 */
const isSupersetControl = (controlType: string) =>
  and(
    isControl,
    (uischema: any) => uischema.options?.controlType === controlType,
  );

/**
 * Custom renderers for all Superset-specific controls
 */
export const supersetControlRenderers = [
  // Metrics and dimensions
  {
    tester: rankWith(10, isSupersetControl('MetricsControl')),
    renderer: createSupersetControlRenderer('MetricsControl', MetricsControl),
  },
  {
    tester: rankWith(10, isSupersetControl('MetricControl')),
    renderer: createSupersetControlRenderer('MetricControl', MetricControl),
  },
  {
    tester: rankWith(10, isSupersetControl('GroupByControl')),
    renderer: createSupersetControlRenderer('GroupByControl', GroupByControl),
  },
  {
    tester: rankWith(10, isSupersetControl('ColumnsControl')),
    renderer: createSupersetControlRenderer('ColumnsControl', ColumnsControl),
  },
  {
    tester: rankWith(10, isSupersetControl('AdhocFiltersControl')),
    renderer: createSupersetControlRenderer(
      'AdhocFiltersControl',
      AdhocFiltersControl,
    ),
  },

  // Sorting and limits
  {
    tester: rankWith(10, isSupersetControl('RowLimitControl')),
    renderer: createSupersetControlRenderer('RowLimitControl', RowLimitControl),
  },
  {
    tester: rankWith(10, isSupersetControl('SortByMetricControl')),
    renderer: createSupersetControlRenderer(
      'SortByMetricControl',
      SortByMetricControl,
    ),
  },

  // Time controls
  {
    tester: rankWith(10, isSupersetControl('TimeRangeControl')),
    renderer: createSupersetControlRenderer(
      'TimeRangeControl',
      TimeRangeControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('TimeGrainSqlaControl')),
    renderer: createSupersetControlRenderer(
      'TimeGrainSqlaControl',
      TimeGrainSqlaControl,
    ),
  },

  // Color controls
  {
    tester: rankWith(10, isSupersetControl('ColorSchemeControl')),
    renderer: createSupersetControlRenderer(
      'ColorSchemeControl',
      ColorSchemeControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('LinearColorSchemeControl')),
    renderer: createSupersetControlRenderer(
      'LinearColorSchemeControl',
      LinearColorSchemeControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('ColorPickerControl')),
    renderer: createSupersetControlRenderer(
      'ColorPickerControl',
      ColorPickerControl,
    ),
  },

  // Format controls
  {
    tester: rankWith(10, isSupersetControl('YAxisFormatControl')),
    renderer: createSupersetControlRenderer(
      'YAxisFormatControl',
      YAxisFormatControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('CurrencyFormatControl')),
    renderer: createSupersetControlRenderer(
      'CurrencyFormatControl',
      CurrencyFormatControl,
    ),
  },

  // Data source controls
  {
    tester: rankWith(10, isSupersetControl('DatasourceControl')),
    renderer: createSupersetControlRenderer(
      'DatasourceControl',
      DatasourceControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('VizTypeControl')),
    renderer: createSupersetControlRenderer('VizTypeControl', VizTypeControl),
  },

  // Series and entity controls
  {
    tester: rankWith(10, isSupersetControl('SeriesControl')),
    renderer: createSupersetControlRenderer('SeriesControl', SeriesControl),
  },
  {
    tester: rankWith(10, isSupersetControl('EntityControl')),
    renderer: createSupersetControlRenderer('EntityControl', EntityControl),
  },
  {
    tester: rankWith(10, isSupersetControl('XAxisControl')),
    renderer: createSupersetControlRenderer('XAxisControl', XAxisControl),
  },
  {
    tester: rankWith(10, isSupersetControl('SecondaryMetricControl')),
    renderer: createSupersetControlRenderer(
      'SecondaryMetricControl',
      SecondaryMetricControl,
    ),
  },

  // Tooltip controls
  {
    tester: rankWith(10, isSupersetControl('TooltipColumnsControl')),
    renderer: createSupersetControlRenderer(
      'TooltipColumnsControl',
      TooltipColumnsControl,
    ),
  },
  {
    tester: rankWith(10, isSupersetControl('TooltipMetricsControl')),
    renderer: createSupersetControlRenderer(
      'TooltipMetricsControl',
      TooltipMetricsControl,
    ),
  },
];

/**
 * Get the control type for a given control name
 */
export function getControlType(controlName: string): string | undefined {
  const controlTypeMap: Record<string, string> = {
    metrics: 'MetricsControl',
    metric: 'MetricControl',
    groupby: 'GroupByControl',
    columns: 'ColumnsControl',
    adhoc_filters: 'AdhocFiltersControl',
    row_limit: 'RowLimitControl',
    sort_by_metric: 'SortByMetricControl',
    time_range: 'TimeRangeControl',
    time_grain_sqla: 'TimeGrainSqlaControl',
    color_scheme: 'ColorSchemeControl',
    linear_color_scheme: 'LinearColorSchemeControl',
    color_picker: 'ColorPickerControl',
    y_axis_format: 'YAxisFormatControl',
    currency_format: 'CurrencyFormatControl',
    datasource: 'DatasourceControl',
    viz_type: 'VizTypeControl',
    series: 'SeriesControl',
    entity: 'EntityControl',
    x_axis: 'XAxisControl',
    secondary_metric: 'SecondaryMetricControl',
    tooltip_columns: 'TooltipColumnsControl',
    tooltip_metrics: 'TooltipMetricsControl',
  };

  return controlTypeMap[controlName];
}
