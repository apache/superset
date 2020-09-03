/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import data from './data';

new SankeyChartPlugin().configure({ key: 'sankey' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-sankey',
};

export const basic = () => (
  <SuperChart
    chartType="sankey"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      colorScheme: 'd3Category10',
    }}
  />
);
