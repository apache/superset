/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="parallel-coordinates"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          includeSeries: false,
          linearColorScheme: 'schemeRdYlBu',
          metrics: ['sum__SP_POP_TOTL', 'sum__SP_RUR_TOTL_ZS', 'sum__SH_DYN_AIDS'],
          secondaryMetric: 'sum__SP_POP_TOTL',
          series: 'country_name',
          showDatatable: false,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-parallel-coordinates|ParallelCoordinatesChartPlugin',
  },
];
