/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="line"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          bottomMargin: 'auto',
          colorScheme: 'd3Category10',
          leftMargin: 'auto',
          lineInterpolation: 'linear',
          richTooltip: true,
          showBrush: 'auto',
          showLegend: true,
          showMarkers: false,
          vizType: 'line',
          xAxisFormat: 'smart_date',
          xAxisLabel: '',
          xAxisShowminmax: false,
          xTicksLayout: 'auto',
          yAxisBounds: [null, null],
          yAxisFormat: '.3s',
          yAxisLabel: '',
          yAxisShowminmax: false,
          yLogScale: false,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|LineChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="line"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          bottomMargin: 'auto',
          colorScheme: 'd3Category10',
          leftMargin: 'auto',
          lineInterpolation: 'linear',
          richTooltip: true,
          showBrush: 'auto',
          showLegend: true,
          showMarkers: true,
          vizType: 'line',
          xAxisFormat: 'smart_date',
          xAxisLabel: '',
          xAxisShowminmax: false,
          xTicksLayout: 'auto',
          yAxisBounds: [null, null],
          yAxisFormat: '.3s',
          yAxisLabel: '',
          yAxisShowminmax: false,
          yLogScale: false,
        }}
      />
    ),
    storyName: 'Markers',
    storyPath: 'legacy-|preset-chart-nvd3|LineChartPlugin',
  },
];
