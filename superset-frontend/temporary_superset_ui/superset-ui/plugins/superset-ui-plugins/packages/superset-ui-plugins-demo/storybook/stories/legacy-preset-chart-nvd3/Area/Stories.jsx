/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="area"
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
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'area',
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
    storyName: 'Stacked',
    storyPath: 'legacy-|preset-chart-nvd3|AreaChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="area"
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
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'area',
            xAxisFormat: '%Y',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [0, 3000000000],
            yAxisFormat: '.3s',
            yLogScale: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Stacked with yAxisBounds',
    storyPath: 'legacy-|preset-chart-nvd3|AreaChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="area"
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
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'area',
            xAxisFormat: '%Y',
            xAxisLabel: '',
            xAxisShowminmax: false,
            xTicksLayout: 'auto',
            yAxisBounds: [1000000000, null],
            yAxisFormat: '.3s',
            yLogScale: false,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Stacked with yAxisBounds min only',
    storyPath: 'legacy-|preset-chart-nvd3|AreaChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="area"
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
            showBrush: 'auto',
            showControls: false,
            showLegend: true,
            stackedStyle: 'expand',
            vizType: 'area',
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
    storyName: 'Expanded',
    storyPath: 'legacy-|preset-chart-nvd3|AreaChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="area"
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
            showBrush: 'auto',
            showControls: true,
            showLegend: true,
            stackedStyle: 'stack',
            vizType: 'area',
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
    storyName: 'Controls Shown',
    storyPath: 'legacy-|preset-chart-nvd3|AreaChartPlugin',
  },
];
