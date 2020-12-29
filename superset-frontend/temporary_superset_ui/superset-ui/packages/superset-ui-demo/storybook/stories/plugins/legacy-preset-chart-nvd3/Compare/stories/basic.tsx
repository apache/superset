import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="compare"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      contribution: false,
      leftMargin: 'auto',
      vizType: 'compare',
      xAxisFormat: 'smart_date',
      xAxisLabel: '',
      xAxisShowminmax: false,
      xTicksLayout: 'auto',
      yAxisBounds: [null, null],
      yAxisFormat: '.3s',
      yAxisLabel: '',
      yAxisShowminmax: false,
      yLogscale: false,
    }}
  />
);
