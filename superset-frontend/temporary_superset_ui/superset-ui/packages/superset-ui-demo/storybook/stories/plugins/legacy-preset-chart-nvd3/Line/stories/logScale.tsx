import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const logScale = () => (
  <SuperChart
    chartType="line"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queryData={{ data }}
    formData={{
      richTooltip: true,
      vizType: 'line',
      yAxisBounds: [1, 60000],
      yAxisFormat: ',d',
      yLogScale: true,
    }}
  />
);
