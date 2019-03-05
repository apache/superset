/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="bar"
        chartProps={{
          datasource: {
            verboseMap: {},
          },
          formData: {
            bottomMargin: 'auto',
            colorCcheme: 'd3Category10',
            contribution: false,
            groupby: ['region'],
            lineInterpolation: 'linear',
            metrics: ['sum__SP_POP_TOTL'],
            richTooltip: true,
            showBarValue: false,
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'bar',
            xAxisFormat: '%Y',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [null, null],
            yAxisFormat: '.3s',
            yLogScale: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|BarChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="bar"
        chartProps={{
          datasource: {
            verboseMap: {},
          },
          formData: {
            bottomMargin: 'auto',
            colorCcheme: 'd3Category10',
            contribution: false,
            groupby: ['region'],
            lineInterpolation: 'linear',
            metrics: ['sum__SP_POP_TOTL'],
            richTooltip: true,
            showBarValue: true,
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'bar',
            xAxisFormat: '%Y',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [null, null],
            yAxisFormat: '.3s',
            yLogScale: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Bar with values',
    storyPath: 'legacy-|preset-chart-nvd3|BarChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="bar"
        chartProps={{
          datasource: {
            verboseMap: {},
          },
          formData: {
            bottomMargin: 'auto',
            colorCcheme: 'd3Category10',
            contribution: false,
            groupby: ['region'],
            lineInterpolation: 'linear',
            metrics: ['sum__SP_POP_TOTL'],
            richTooltip: true,
            showBarValue: true,
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'bar',
            xAxisFormat: '%Y',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [null, null],
            yAxisFormat: '.3s',
            yLogScale: false,
          },
          height: 400,
          payload: {
            data: data.map((group, i) => ({
              ...group,
              values: group.values.map(pair => ({ ...pair, y: (i % 2 === 0 ? 1 : -1) * pair.y })),
            })),
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Bar with positive and negative values',
    storyPath: 'legacy-|preset-chart-nvd3|BarChartPlugin',
  },
];
