/* eslint-disable sort-keys, no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="calendar"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            cellSize: 10,
            cellPadding: 2,
            cellRadius: 0,
            linearColorScheme: 'schemeRdYlBu',
            steps: 10,
            yAxisFormat: '.3s',
            xAxisTimeFormat: 'smart_date',
            showLegend: true,
            showValues: false,
            showMetricName: true,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-calendar|CalendarChartPlugin',
  },
];
