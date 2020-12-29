import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="dist-bar"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      barstacked: false,
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      contribution: false,
      orderBars: false,
      reduceXTicks: false,
      showBarValue: false,
      showControls: false,
      showLegend: true,
      vizType: 'dist_bar',
      xAxisLabel: 'ddd',
      xTicksLayout: 'auto',
      yAxisFormat: '.3s',
      yAxisLabel: 'ddd',
    }}
  />
);
