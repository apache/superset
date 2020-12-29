/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import data from './data';

new PairedTTestChartPlugin().configure({ key: 'paired-t-test' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-paired-t-test',
};

export const basic = () => (
  <SuperChart
    chartType="paired-t-test"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      groupby: ['name'],
      liftvaluePrecision: 4,
      metrics: ['sum__num'],
      pvaluePrecision: 6,
      significanceLevel: 0.05,
    }}
  />
);
