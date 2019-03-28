/* eslint-disable no-magic-numbers */
import * as React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import data from '../data/legacyData';
import { LINE_PLUGIN_LEGACY_TYPE } from '../constants';

export default [
  {
    renderStory: () => [
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_LEGACY_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />,
      <SuperChart
        key="line2"
        chartType={LINE_PLUGIN_LEGACY_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
            },
            height: 400,
            payload: { data },
            width: 800,
          })
        }
      />,
    ],
    storyName: 'Use Legacy API shim',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
