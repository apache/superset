/* eslint-disable no-magic-numbers */
import * as React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import data from '../data/legacyData';
import { SCATTER_PLOT_PLUGIN_LEGACY_TYPE } from '../constants';

export default [
  {
    renderStory: () => [
      <SuperChart
        key="scatter-plot1"
        chartType={SCATTER_PLOT_PLUGIN_LEGACY_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />,
    ],
    storyName: 'Use Legacy API shim',
    storyPath: 'preset-chart-xy|ScatterPlotPlugin',
  },
];
