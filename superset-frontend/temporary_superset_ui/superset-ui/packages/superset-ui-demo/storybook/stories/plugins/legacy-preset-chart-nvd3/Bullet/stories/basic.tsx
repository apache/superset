import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';
import data from '../data';

export const basic = () => (
  <SuperChart
    chartType="bullet"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      markerLabels: '',
      markerLineLabels: '',
      markerLines: '',
      markers: '',
      rangeLabels: '',
      ranges: '',
      vizType: 'bullet',
    }}
  />
);
