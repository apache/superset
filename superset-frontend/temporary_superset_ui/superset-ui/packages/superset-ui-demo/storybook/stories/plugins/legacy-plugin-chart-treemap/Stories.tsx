/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';
import data from './data';

new TreemapChartPlugin().configure({ key: 'treemap' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-treemap',
};

export const basic = () => (
  <SuperChart
    chartType="treemap"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      numberFormat: '.3s',
      treeMapRatio: 1.618033988749895,
    }}
  />
);
