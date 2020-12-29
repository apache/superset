import React from 'react';
import { SuperChart } from '@superset-ui/core';
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import data from './data';
import dummyDatasource from '../../../shared/dummyDatasource';

new PartitionChartPlugin().configure({ key: 'partition' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-partition',
};

export const basic = () => (
  <SuperChart
    chartType="partition"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      dateTimeFormat: '%Y-%m-%d',
      equalDateSize: true,
      groupby: ['region', 'country_code'],
      logScale: false,
      metrics: ['sum__SP_POP_TOTL'],
      numberFormat: '.3s',
      partitionLimit: '5',
      partitionThreshold: '0.05',
      richTooltip: true,
      timeSeriesOption: 'not-time',
    }}
  />
);
