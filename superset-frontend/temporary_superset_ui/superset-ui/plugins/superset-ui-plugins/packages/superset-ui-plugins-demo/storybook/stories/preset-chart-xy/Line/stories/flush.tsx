/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import { radios } from '@storybook/addon-knobs';
import rawData from '../data/data';
import { LINE_PLUGIN_TYPE } from '../constants';

const MIN_TIME = new Date(Date.UTC(1980, 0, 1)).getTime();
const MAX_TIME = new Date(Date.UTC(2000, 1, 1)).getTime();
const data = rawData.filter(({ x }) => x >= MIN_TIME && x <= MAX_TIME);

export default [
  {
    renderStory: () => [
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
              encoding: {
                x: {
                  field: 'x',
                  type: 'temporal',
                  format: '%Y',
                  scale: {
                    type: 'utc',
                  },
                  axis: {
                    tickCount: 6,
                    orient: radios('x.axis.orient', { top: 'top', bottom: 'bottom' }, 'bottom'),
                    title: radios(
                      'x.axis.title',
                      { enable: 'Time', disable: '', '': undefined },
                      'Time',
                    ),
                  },
                },
                y: {
                  field: 'y',
                  type: 'quantitative',
                  scale: {
                    type: 'linear',
                  },
                  axis: {
                    tickCount: 3,
                    orient: radios(
                      'y.axis.orient',
                      { left: 'left', right: 'right', '': undefined },
                      'left',
                    ),
                    title: radios(
                      'y.axis.title',
                      { enable: 'Score', disable: '', '': undefined },
                      'Score',
                    ),
                  },
                },
                stroke: {
                  field: 'name',
                  type: 'nominal',
                  legend: true,
                },
              },
            },
            height: 200,
            payload: { data },
            width: 400,
          })
        }
      />,
      <SuperChart
        key="line1"
        chartType={LINE_PLUGIN_TYPE}
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
              encoding: {
                x: {
                  field: 'x',
                  type: 'temporal',
                  format: '%Y',
                  scale: {
                    type: 'utc',
                  },
                  axis: {
                    labelFlush: 5,
                    tickCount: 6,
                    orient: radios('x.axis.orient', { top: 'top', bottom: 'bottom' }, 'bottom'),
                    title: radios(
                      'x.axis.title',
                      { enable: 'Time', disable: '', '': undefined },
                      'Time',
                    ),
                  },
                },
                y: {
                  field: 'y',
                  type: 'quantitative',
                  scale: {
                    type: 'linear',
                  },
                  axis: {
                    tickCount: 3,
                    orient: radios(
                      'y.axis.orient',
                      { left: 'left', right: 'right', '': undefined },
                      'left',
                    ),
                    title: radios(
                      'y.axis.title',
                      { enable: 'Score', disable: '', '': undefined },
                      'Score',
                    ),
                  },
                },
                stroke: {
                  field: 'name',
                  type: 'nominal',
                  legend: true,
                },
              },
            },
            height: 200,
            payload: { data },
            width: 400,
          })
        }
      />,
    ],
    storyName: 'with labelFlush',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
