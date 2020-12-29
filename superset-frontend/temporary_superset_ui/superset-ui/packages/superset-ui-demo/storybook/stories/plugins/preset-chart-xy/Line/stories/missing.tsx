import React from 'react';
import { SuperChart, seedRandom } from '@superset-ui/core';
import data from '../data/data';
import { LINE_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

const missingData = data.map(({ y, ...rest }) => ({
  ...rest,
  y: seedRandom() < 0.25 ? null : y,
}));

const missing = () => (
  <SuperChart
    key="line1"
    chartType={LINE_PLUGIN_TYPE}
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data: missingData }]}
    formData={{
      encoding: {
        x: {
          field: 'x',
          type: 'temporal',
          format: '%Y',
          scale: {
            type: 'time',
          },
          axis: {
            orient: 'bottom',
            title: 'Time',
          },
        },
        y: {
          field: 'y',
          type: 'quantitative',
          scale: {
            type: 'linear',
          },
          axis: {
            orient: 'left',
            title: 'Score',
          },
        },
        stroke: {
          field: 'name',
          type: 'nominal',
          scale: {},
          legend: true,
        },
      },
    }}
  />
);

export default missing;
