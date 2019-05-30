/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dataLegacy from './dataLegacy';
import data from './data';
export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="table2-legacy"
        chartProps={{
          datasource: {
            columnFormats: {},
            verboseMap: {
              name: 'name',
              sum__num: 'sum__num',
            },
          },
          filters: {},
          formData: {
            alignPn: false,
            colorPn: true,
            includeSearch: false,
            metrics: ['sum__num', 'trend'],
            orderDesc: true,
            pageLength: 0,
            percentMetrics: ['sum__num'],
            tableFilter: false,
            tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
            timeseriesLimitMetric: 'trend',
          },
          height: 400,
          payload: { data: dataLegacy },
          width: 400,
        }}
      />
    ),
    storyName: 'Legacy',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="table2-legacy"
        chartProps={{
          datasource: {
            columnFormats: {},
            verboseMap: {
              name: 'name',
              sum__num: 'sum__num',
            },
          },
          filters: {},
          formData: {
            alignPn: true,
            colorPn: true,
            includeSearch: true,
            pageLength: 0,
            metrics: ['sum__num', 'trend'],
            orderDesc: true,
            pageLength: 0,
            percentMetrics: [],
            tableFilter: true,
            tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
            timeseriesLimitMetric: null,
          },
          height: 400,
          payload: { data: dataLegacy },
          width: 400,
        }}
      />
    ),
    storyName: 'Legacy-TableFilter',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="table2"
        chartProps={{
          datasource: {
            columnFormats: {},
            verboseMap: {
              name: 'name',
              sum__num: 'sum__num',
            },
          },
          filters: {},
          formData: {
            alignPn: false,
            colorPn: true,
            includeSearch: true,
            pageLength: 0,
            metrics: ['sum__num', 'trend'],
            orderDesc: true,
            pageLength: 0,
            percentMetrics: ['sum__num'],
            tableFilter: true,
            tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
            timeseriesLimitMetric: null,
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'TableFilter',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
];
