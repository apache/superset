/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { radios } from '@storybook/addon-knobs';
import dummyDatasource from '../../../../shared/dummyDatasource';
import data from '../data/data';
import { SCATTER_PLOT_PLUGIN_TYPE } from '../constants';

export default [
  {
    renderStory: () => [
      <SuperChart
        key="scatter-plot1"
        chartType={SCATTER_PLOT_PLUGIN_TYPE}
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          encoding: {
            x: {
              field: 'sum__SP_RUR_TOTL_ZS',
              type: 'quantitative',
              scale: {
                type: 'linear',
              },
              axis: {
                orient: radios('x.axis.orient', ['top', 'bottom'], 'bottom'),
              },
            },
            y: {
              field: 'sum__SP_DYN_LE00_IN',
              type: 'quantitative',
              scale: {
                type: 'linear',
              },
              axis: {
                orient: radios('y.axis.orient', ['left', 'right'], 'left'),
              },
            },
            size: {
              field: 'sum__SP_POP_TOTL',
              type: 'quantitative',
              scale: {
                type: 'linear',
                range: [0, 30],
              },
            },
            fill: {
              field: 'region',
              type: 'nominal',
              legend: true,
            },
            group: [{ field: 'country_name', title: 'Country' }],
          },
        }}
      />,
    ],
    storyName: 'Bubble',
    storyPath: 'preset-chart-xy|ScatterPlotPlugin',
  },
];
