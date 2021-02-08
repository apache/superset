import React from 'react';
import { SuperChart } from '@superset-ui/core';
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

new CalendarChartPlugin().configure({ key: 'calendar' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-calendar',
};

export const basic = () => (
  <SuperChart
    chartType="calendar"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
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
);
