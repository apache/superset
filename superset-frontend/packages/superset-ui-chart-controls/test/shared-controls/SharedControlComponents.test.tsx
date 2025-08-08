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
  MetricsControl,
  MetricControl,
  GroupByControl,
  ColumnsControl,
  AdhocFiltersControl,
  LimitControl,
  RowLimitControl,
  OrderByControl,
  OrderDescControl,
  SeriesControl,
  EntityControl,
  XControl,
  YControl,
  SizeControl,
  ColorSchemeControl,
  LinearColorSchemeControl,
  ColorPickerControl,
  TimeRangeControl,
  GranularitySqlaControl,
  TimeGrainSqlaControl,
  DatasourceControl,
  VizTypeControl,
  XAxisControl,
  YAxisFormatControl,
  XAxisTimeFormatControl,
  ZoomableControl,
  SortByMetricControl,
  CurrencyFormatControl,
  TooltipColumnsControl,
  TooltipMetricsControl,
  sharedControls,
} from '../../src';

describe('SharedControlComponents', () => {
  describe('React Component Controls', () => {
    it('should return proper control items for metrics controls', () => {
      const metricsControl = MetricsControl();
      expect(metricsControl).toEqual({
        name: 'metrics',
        config: sharedControls.metrics,
      });

      const metricControl = MetricControl();
      expect(metricControl).toEqual({
        name: 'metric',
        config: sharedControls.metric,
      });
    });

    it('should return proper control items for dimension controls', () => {
      const groupByControl = GroupByControl();
      expect(groupByControl).toEqual({
        name: 'groupby',
        config: sharedControls.groupby,
      });

      const columnsControl = ColumnsControl();
      expect(columnsControl).toEqual({
        name: 'columns',
        config: sharedControls.columns,
      });

      const seriesControl = SeriesControl();
      expect(seriesControl).toEqual({
        name: 'series',
        config: sharedControls.series,
      });

      const entityControl = EntityControl();
      expect(entityControl).toEqual({
        name: 'entity',
        config: sharedControls.entity,
      });
    });

    it('should return proper control items for filter controls', () => {
      const adhocFiltersControl = AdhocFiltersControl();
      expect(adhocFiltersControl).toEqual({
        name: 'adhoc_filters',
        config: sharedControls.adhoc_filters,
      });
    });

    it('should return proper control items for limit controls', () => {
      const limitControl = LimitControl();
      expect(limitControl).toEqual({
        name: 'limit',
        config: sharedControls.limit,
      });

      const rowLimitControl = RowLimitControl();
      expect(rowLimitControl).toEqual({
        name: 'row_limit',
        config: sharedControls.row_limit,
      });
    });

    it('should return proper control items for sort controls', () => {
      const orderByControl = OrderByControl();
      expect(orderByControl).toEqual({
        name: 'orderby',
        config: sharedControls.orderby,
      });

      const orderDescControl = OrderDescControl();
      expect(orderDescControl).toEqual({
        name: 'order_desc',
        config: sharedControls.order_desc,
      });

      const sortByMetricControl = SortByMetricControl();
      expect(sortByMetricControl).toEqual({
        name: 'sort_by_metric',
        config: sharedControls.sort_by_metric,
      });
    });

    it('should return proper control items for axis controls', () => {
      const xControl = XControl();
      expect(xControl).toEqual({
        name: 'x',
        config: sharedControls.x,
      });

      const yControl = YControl();
      expect(yControl).toEqual({
        name: 'y',
        config: sharedControls.y,
      });

      const xAxisControl = XAxisControl();
      expect(xAxisControl).toEqual({
        name: 'x_axis',
        config: sharedControls.x_axis,
      });

      // Note: YAxisControl doesn't exist, YControl is reused for y axis
      const yControl2 = YControl();
      expect(yControl2).toEqual({
        name: 'y',
        config: sharedControls.y,
      });
    });

    it('should return proper control items for formatting controls', () => {
      const yAxisFormatControl = YAxisFormatControl();
      expect(yAxisFormatControl).toEqual({
        name: 'y_axis_format',
        config: sharedControls.y_axis_format,
      });

      const xAxisTimeFormatControl = XAxisTimeFormatControl();
      expect(xAxisTimeFormatControl).toEqual({
        name: 'x_axis_time_format',
        config: sharedControls.x_axis_time_format,
      });

      const currencyFormatControl = CurrencyFormatControl();
      expect(currencyFormatControl).toEqual({
        name: 'currency_format',
        config: sharedControls.currency_format,
      });
    });

    it('should return proper control items for color controls', () => {
      const colorSchemeControl = ColorSchemeControl();
      expect(colorSchemeControl).toEqual({
        name: 'color_scheme',
        config: sharedControls.color_scheme,
      });

      const linearColorSchemeControl = LinearColorSchemeControl();
      expect(linearColorSchemeControl).toEqual({
        name: 'linear_color_scheme',
        config: sharedControls.linear_color_scheme,
      });

      const colorPickerControl = ColorPickerControl();
      expect(colorPickerControl).toEqual({
        name: 'color_picker',
        config: sharedControls.color_picker,
      });
    });

    it('should return proper control items for time controls', () => {
      const timeRangeControl = TimeRangeControl();
      expect(timeRangeControl).toEqual({
        name: 'time_range',
        config: sharedControls.time_range,
      });

      const granularitySqlaControl = GranularitySqlaControl();
      expect(granularitySqlaControl).toEqual({
        name: 'granularity_sqla',
        config: sharedControls.granularity_sqla,
      });

      const timeGrainSqlaControl = TimeGrainSqlaControl();
      expect(timeGrainSqlaControl).toEqual({
        name: 'time_grain_sqla',
        config: sharedControls.time_grain_sqla,
      });
    });

    it('should return proper control items for datasource controls', () => {
      const datasourceControl = DatasourceControl();
      expect(datasourceControl).toEqual({
        name: 'datasource',
        config: sharedControls.datasource,
      });

      const vizTypeControl = VizTypeControl();
      expect(vizTypeControl).toEqual({
        name: 'viz_type',
        config: sharedControls.viz_type,
      });
    });

    it('should return proper control items for tooltip controls', () => {
      const tooltipColumnsControl = TooltipColumnsControl();
      expect(tooltipColumnsControl).toEqual({
        name: 'tooltip_columns',
        config: sharedControls.tooltip_columns,
      });

      const tooltipMetricsControl = TooltipMetricsControl();
      expect(tooltipMetricsControl).toEqual({
        name: 'tooltip_metrics',
        config: sharedControls.tooltip_metrics,
      });
    });

    it('should return proper control items for other controls', () => {
      const sizeControl = SizeControl();
      expect(sizeControl).toEqual({
        name: 'size',
        config: sharedControls.size,
      });

      const zoomableControl = ZoomableControl();
      expect(zoomableControl).toEqual({
        name: 'zoomable',
        config: sharedControls.zoomable,
      });
    });
  });

  describe('Control compatibility', () => {
    it('should be usable in control panel configurations', () => {
      // Simulate a control panel configuration
      const controlPanel = {
        controlPanelSections: [
          {
            label: 'Query',
            expanded: true,
            controlSetRows: [
              [MetricsControl()],
              [GroupByControl()],
              [AdhocFiltersControl()],
              [LimitControl(), OrderDescControl()],
              [RowLimitControl()],
            ],
          },
          {
            label: 'Chart Options',
            expanded: true,
            controlSetRows: [[ColorSchemeControl()], [YAxisFormatControl()]],
          },
        ],
      };

      // Verify structure
      expect(controlPanel.controlPanelSections).toHaveLength(2);

      // Verify first section
      const querySection = controlPanel.controlPanelSections[0];
      expect(querySection.controlSetRows[0][0]).toHaveProperty(
        'name',
        'metrics',
      );
      expect(querySection.controlSetRows[1][0]).toHaveProperty(
        'name',
        'groupby',
      );
      expect(querySection.controlSetRows[2][0]).toHaveProperty(
        'name',
        'adhoc_filters',
      );
      expect(querySection.controlSetRows[3][0]).toHaveProperty('name', 'limit');
      expect(querySection.controlSetRows[3][1]).toHaveProperty(
        'name',
        'order_desc',
      );
      expect(querySection.controlSetRows[4][0]).toHaveProperty(
        'name',
        'row_limit',
      );

      // Verify second section
      const optionsSection = controlPanel.controlPanelSections[1];
      expect(optionsSection.controlSetRows[0][0]).toHaveProperty(
        'name',
        'color_scheme',
      );
      expect(optionsSection.controlSetRows[1][0]).toHaveProperty(
        'name',
        'y_axis_format',
      );
    });
  });
});
