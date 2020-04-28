import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="line"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queryData={{ data }}
    formData={{
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      leftMargin: 'auto',
      lineInterpolation: 'linear',
      richTooltip: true,
      showBrush: 'auto',
      showLegend: true,
      showMarkers: false,
      vizType: 'line',
      xAxisFormat: 'smart_date',
      xAxisLabel: '',
      xAxisShowminmax: false,
      xTicksLayout: 'auto',
      yAxisBounds: [null, null],
      yAxisFormat: '.3s',
      yAxisLabel: '',
      yAxisShowminmax: false,
      yLogScale: false,
    }}
  />
);
