import React from 'react';
import { SuperChart } from '@superset-ui/core';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export const timeFormat = () => (
  <SuperChart
    chartType="compare"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[
      {
        data: [
          {
            key: ['Africa and Middle East'],
            values: [
              {
                x: 1606348800000,
                y: 3985,
              },
              {
                x: 1606435200000,
                y: 5882,
              },
              {
                x: 1606521600000,
                y: 7983,
              },
              {
                x: 1606608000000,
                y: 16462,
              },
              {
                x: 1606694400000,
                y: 5542,
              },
              {
                x: 1606780800000,
                y: 2825,
              },
            ],
          },
          {
            key: ['Asia'],
            values: [
              {
                x: 1606348800000,
                y: 34837,
              },
              {
                x: 1606435200000,
                y: 40718,
              },
              {
                x: 1606521600000,
                y: 58507,
              },
              {
                x: 1606608000000,
                y: 110120,
              },
              {
                x: 1606694400000,
                y: 43443,
              },
              {
                x: 1606780800000,
                y: 33538,
              },
            ],
          },
          {
            key: ['Australia'],
            values: [
              {
                x: 1606348800000,
                y: 12975,
              },
              {
                x: 1606435200000,
                y: 18471,
              },
              {
                x: 1606521600000,
                y: 17880,
              },
              {
                x: 1606608000000,
                y: 52204,
              },
              {
                x: 1606694400000,
                y: 26690,
              },
              {
                x: 1606780800000,
                y: 16423,
              },
            ],
          },
          {
            key: ['Europe'],
            values: [
              {
                x: 1606348800000,
                y: 127029,
              },
              {
                x: 1606435200000,
                y: 177637,
              },
              {
                x: 1606521600000,
                y: 172653,
              },
              {
                x: 1606608000000,
                y: 203654,
              },
              {
                x: 1606694400000,
                y: 79200,
              },
              {
                x: 1606780800000,
                y: 45238,
              },
            ],
          },
          {
            key: ['LatAm'],
            values: [
              {
                x: 1606348800000,
                y: 22513,
              },
              {
                x: 1606435200000,
                y: 24594,
              },
              {
                x: 1606521600000,
                y: 32578,
              },
              {
                x: 1606608000000,
                y: 34733,
              },
              {
                x: 1606694400000,
                y: 71696,
              },
              {
                x: 1606780800000,
                y: 166611,
              },
            ],
          },
          {
            key: ['North America'],
            values: [
              {
                x: 1606348800000,
                y: 104596,
              },
              {
                x: 1606435200000,
                y: 109850,
              },
              {
                x: 1606521600000,
                y: 136873,
              },
              {
                x: 1606608000000,
                y: 133243,
              },
              {
                x: 1606694400000,
                y: 327739,
              },
              {
                x: 1606780800000,
                y: 162711,
              },
            ],
          },
        ],
      },
    ]}
    formData={{
      datasource: '24771__table',
      vizType: 'compare',
      urlParams: {},
      timeRangeEndpoints: ['inclusive', 'exclusive'],
      granularitySqla: '__time',
      timeGrainSqla: 'P1D',
      timeRange: 'Last week',
      metrics: ['random_metric'],
      adhocFilters: [],
      groupby: ['dim_origin_region'],
      timeseriesLimitMetric: null,
      orderDesc: true,
      contribution: false,
      rowLimit: 10000,
      colorScheme: 'd3Category10',
      labelColors: {},
      xAxisLabel: '',
      bottomMargin: 'auto',
      xTicksLayout: 'auto',
      xAxisFormat: 'smart_date',
      xAxisShowminmax: false,
      yAxisLabel: '',
      leftMargin: 'auto',
      yAxisShowminmax: false,
      yLogScale: false,
      yAxisFormat: 'SMART_NUMBER',
      yAxisBounds: [null, null],
      rollingType: 'None',
      comparisonType: 'values',
      resampleRule: null,
      resampleMethod: null,
      annotationLayers: [],
      appliedTimeExtras: {},
      where: '',
      having: '',
      havingFilters: [],
      filters: [],
    }}
  />
);
