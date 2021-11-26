import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const stacked = () => (
  <SuperChart
    id="stacked-area-chart"
    chartType="area"
    datasource={dummyDatasource}
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      contribution: false,
      groupby: ['region'],
      lineInterpolation: 'linear',
      metrics: ['sum__SP_POP_TOTL'],
      richTooltip: true,
      showBrush: 'auto',
      showControls: false,
      showLegend: true,
      stackedStyle: 'stack',
      vizType: 'area',
      xAxisFormat: '%Y',
      xAxisLabel: '',
      xAxisShowminmax: false,
      xTicksLayout: 'auto',
      yAxisBounds: [null, null],
      yAxisFormat: '.3s',
      yLogScale: false,
    }}
  />
);
