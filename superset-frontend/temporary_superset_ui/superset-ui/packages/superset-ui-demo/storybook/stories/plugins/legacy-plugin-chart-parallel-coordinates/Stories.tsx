import React from 'react';
import { SuperChart } from '@superset-ui/core';
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';
import data from './data';

new ParallelCoordinatesChartPlugin().configure({ key: 'parallel-coordinates' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-parallel-coordinates',
};

export const basic = () => (
  <SuperChart
    chartType="parallel-coordinates"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      includeSeries: false,
      linearColorScheme: 'schemeRdYlBu',
      metrics: ['sum__SP_POP_TOTL', 'sum__SP_RUR_TOTL_ZS', 'sum__SH_DYN_AIDS'],
      secondaryMetric: 'sum__SP_POP_TOTL',
      series: 'country_name',
      showDatatable: false,
    }}
  />
);
