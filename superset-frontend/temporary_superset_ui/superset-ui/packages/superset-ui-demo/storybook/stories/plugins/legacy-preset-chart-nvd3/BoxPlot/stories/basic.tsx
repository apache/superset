import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="box-plot"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queryData={{ data }}
    formData={{
      colorScheme: 'd3Category10',
      vizType: 'box_plot',
      whiskerOptions: 'Min/max (no outliers)',
    }}
  />
);
