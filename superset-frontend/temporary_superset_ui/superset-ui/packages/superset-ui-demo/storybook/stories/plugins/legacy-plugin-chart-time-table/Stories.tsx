/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import TimeTableChartPlugin from '@superset-ui/legacy-plugin-chart-time-table';
import data from './data';

new TimeTableChartPlugin().configure({ key: 'time-table' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-time-table',
};

export const basic = () => (
  <SuperChart
    chartType="time-table"
    width={400}
    height={400}
    queriesData={[
      {
        data: {
          columns: [
            'East Asia & Pacific',
            'Latin America & Caribbean',
            'Middle East & North Africa',
            'Sub-Saharan Africa',
          ],
          records: data,
        },
      },
    ]}
    formData={{
      adhocFilters: [],
      groupby: ['region'],
      columnCollection: [
        {
          bounds: [null, null],
          colType: 'spark',
          comparisonType: '',
          d3format: '',
          dateFormat: '',
          height: '',
          key: '0vFMepUDf',
          label: 'Time Series Columns',
          showYAxis: false,
          timeLag: 0,
          timeRatio: '',
          tooltip: '',
          width: '',
          yAxisBounds: [null, null],
        },
      ],
      vizType: 'time-table',
    }}
  />
);
