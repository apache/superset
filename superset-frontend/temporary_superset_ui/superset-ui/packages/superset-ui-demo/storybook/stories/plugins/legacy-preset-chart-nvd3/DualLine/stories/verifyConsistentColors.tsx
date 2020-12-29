import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

const reverseData = data.map(series => ({
  ...series,
  yAxis: series.yAxis === 1 ? 2 : 1,
}));

export const verifyConsistentColors = () => (
  <div>
    <SuperChart
      chartType="dual-line"
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        colorScheme: 'd3Category10',
        vizType: 'dual_line',
        xAxisFormat: 'smart_date',
        yAxis2Format: '.3s',
        yAxisFormat: '.3s',
      }}
    />
    <SuperChart
      chartType="dual-line"
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data: reverseData }]}
      formData={{
        colorScheme: 'd3Category10',
        vizType: 'dual_line',
        xAxisFormat: 'smart_date',
        yAxis2Format: '.3s',
        yAxisFormat: '.3s',
      }}
    />
  </div>
);

verifyConsistentColors.story = {
  name: 'Swap y-axis with consistent color',
};
