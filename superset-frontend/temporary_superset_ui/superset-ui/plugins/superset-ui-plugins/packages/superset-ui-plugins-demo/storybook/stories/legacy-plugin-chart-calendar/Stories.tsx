/* eslint-disable sort-keys, no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';
import dummyDatasource from '../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="calendar"
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
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
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-calendar|CalendarChartPlugin',
  },
];
