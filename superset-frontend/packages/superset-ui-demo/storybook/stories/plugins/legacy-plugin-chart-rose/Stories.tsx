/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';
import data from './data';

new RoseChartPlugin().configure({ key: 'rose' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-rose',
};

export const basic = () => (
  <SuperChart
    chartType="rose"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      dateTimeFormat: '%Y-%m-%d',
      numberFormat: '.3s',
      richTooltip: true,
      roseAreaProportion: false,
    }}
  />
);
