/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';
import data from './data';

new HistogramChartPlugin().configure({ key: 'histogram' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-histogram',
};

export const basic = () => (
  <SuperChart
    chartType="histogram"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      globalOpacity: 1,
      linkLength: 15, // binCount
      normalized: false,
      xAxisLabel: 'Score',
      yAxisLabel: 'Count',
    }}
  />
);
