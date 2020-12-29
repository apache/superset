import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="pie"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      donut: false,
      labelsOutside: true,
      numberFormat: '.3s',
      pieLabelType: 'key',
      showLabels: true,
      showLegend: true,
      vizType: 'pie',
    }}
  />
);
