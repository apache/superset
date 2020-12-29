/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import ForceDirectedChartPlugin from '@superset-ui/legacy-plugin-chart-force-directed';
import data from './data';

new ForceDirectedChartPlugin().configure({ key: 'force-directed' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-force-directed',
};

export const basic = () => (
  <SuperChart chartType="force-directed" width={400} height={400} queriesData={[{ data }]} />
);
