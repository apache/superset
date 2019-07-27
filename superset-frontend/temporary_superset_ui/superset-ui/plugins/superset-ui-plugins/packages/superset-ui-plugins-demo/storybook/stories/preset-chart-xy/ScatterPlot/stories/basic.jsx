/* eslint-disable no-magic-numbers, sort-keys */
import * as React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { radios } from '@storybook/addon-knobs';
import data from '../data/data';
import { SCATTER_PLOT_PLUGIN_TYPE } from '../constants';
import dummyDatasource from '../../../../shared/dummyDatasource';

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
    storyName: 'Basic',
    storyPath: 'preset-chart-xy|ScatterPlotPlugin',
  },
];
