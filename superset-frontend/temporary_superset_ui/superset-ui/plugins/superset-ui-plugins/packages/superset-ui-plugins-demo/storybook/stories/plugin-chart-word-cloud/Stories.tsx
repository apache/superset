/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { select } from '@storybook/addon-knobs';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud"
        width={400}
        height={400}
        queryData={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          metric: 'sum__num',
          rotation: select('Rotation', ['square', 'flat', 'random'], 'square'),
          series: 'name',
          sizeFrom: '10',
          sizeTo: '70',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-word-cloud|WordCloudChartPlugin',
  },
];
