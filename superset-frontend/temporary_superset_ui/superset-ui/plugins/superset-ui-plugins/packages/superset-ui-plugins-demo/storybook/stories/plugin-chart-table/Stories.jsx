/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dataLegacy from './dataLegacy';
import data from './data';
import bigData from './bigData';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="table2-legacy"
        key="table1"
        datasource={{
          columnFormats: {},
          verboseMap: {
            name: 'name',
            sum__num: 'sum__num',
          },
        }}
        formData={{
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
        }}
        queryData={{ data: dataLegacy }}
      />
    ),
    storyName: 'Legacy',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="table2-legacy"
        key="table2"
        datasource={{
          columnFormats: {},
          verboseMap: {
            name: 'name',
            sum__num: 'sum__num',
          },
        }}
        formData={{
          alignPn: false,
          colorPn: true,
          includeSearch: true,
          metrics: ['sum__num'],
          orderDesc: true,
          pageLength: 0,
          percentMetrics: [],
          tableFilter: true,
          tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
          timeseriesLimitMetric: 'trend',
        }}
        queryData={{ data: dataLegacy }}
      />
    ),
    storyName: 'Legacy-TableFilter',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="table2"
        key="table3"
        datasource={{
          columnFormats: {},
          verboseMap: {
            name: 'name',
            sum__num: 'sum__num',
          },
        }}
        formData={{
          alignPn: true,
          colorPn: true,
          includeSearch: true,
          metrics: ['sum__num'],
          orderDesc: true,
          pageLength: 0,
          percentMetrics: ['sum__num'],
          tableFilter: true,
          tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
          timeseriesLimitMetric: null,
        }}
        queryData={{ data }}
      />
    ),
    storyName: 'TableFilter',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="table2"
        key="bigTable"
        datasource={{
          columnFormats: {},
          verboseMap: {},
        }}
        formData={{
          alignPn: true,
          colorPn: true,
          includeSearch: true,
          metrics: [],
          orderDesc: true,
          pageLength: 0,
          percentMetrics: [],
          tableFilter: true,
          tableTimestampFormat: '%Y-%m-%d %H:%M:%S',
          timeseriesLimitMetric: null,
        }}
        queryData={{ data: bigData }}
      />
    ),
    storyName: 'BigTable',
    storyPath: 'plugin-chart-table|TableChartPlugin',
  },
];
