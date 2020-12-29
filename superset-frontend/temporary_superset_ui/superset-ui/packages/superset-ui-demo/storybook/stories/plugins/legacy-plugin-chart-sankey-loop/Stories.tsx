/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import SankeyLoopChartPlugin from '@superset-ui/legacy-plugin-chart-sankey-loop';
import data from './data';

new SankeyLoopChartPlugin().configure({ key: 'sankey-loop' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-sankey-loop',
};

export const basic = () => (
  <SuperChart
    chartType="sankey-loop"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
    }}
  />
);
