import React from 'react';
import { SuperChart } from '@superset-ui/core';
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import data from './data';

new HorizonChartPlugin().configure({ key: 'horizon' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-horizon',
};

export const basic = () => (
  <SuperChart
    chartType="horizon"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      horizonColorScale: 'series',
      seriesHeight: '25',
    }}
  />
);
