/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import { radios } from '@storybook/addon-knobs';
import data from '../data/data';
import { LINE_PLUGIN_TYPE } from '../constants';

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
                    type: 'time',
                  },
                  axis: {
                    orient: radios('x.axis.orient', ['top', 'bottom'], 'bottom'),
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
                    orient: radios('y.axis.orient', ['left', 'right'], 'left'),
                    title: 'Score',
                  },
                },
                color: {
                  field: 'name',
                  type: 'nominal',
                  legend: true,
                },
              },
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />,
    ],
    storyName: 'Basic',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  },
];
