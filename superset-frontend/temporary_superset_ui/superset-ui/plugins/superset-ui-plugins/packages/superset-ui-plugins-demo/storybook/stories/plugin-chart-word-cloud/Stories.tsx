/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { select } from '@storybook/addon-knobs';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud2"
        width={400}
        height={400}
        queryData={{ data }}
        formData={{
          encoding: {
            color: {
              value: '#0097e6',
            },
            fontSize: {
              field: 'sum__num',
              scale: {
                range: [0, 70],
                zero: true,
              },
              type: 'quantitative',
            },
            text: {
              field: 'name',
            },
          },
          metric: 'sum__num',
          rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
          series: 'name',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-word-cloud|WordCloudChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud2"
        width={400}
        height={400}
        queryData={{ data }}
        formData={{
          encoding: {
            color: {
              field: 'name.length',
              scale: {
                range: ['#fbc531', '#c23616'],
                type: 'linear',
                zero: false,
              },
              type: 'quantitative',
            },
            fontSize: {
              field: 'sum__num',
              scale: {
                range: [0, 70],
                zero: true,
              },
              type: 'quantitative',
            },
            text: {
              field: 'name',
            },
          },
          metric: 'sum__num',
          rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
          series: 'name',
        }}
      />
    ),
    storyName: 'encodes color by word length',
    storyPath: 'plugin-chart-word-cloud|WordCloudChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="word-cloud2"
        width={400}
        height={400}
        queryData={{ data }}
        formData={{
          encoding: {
            color: {
              value: '#8c7ae6',
            },
            fontFamily: {
              field: 'name[0]',
              scale: {
                range: ['Helvetica', 'Monaco'],
                type: 'ordinal',
              },
              type: 'nominal',
            },
            fontSize: {
              field: 'sum__num',
              scale: {
                range: [0, 70],
                zero: true,
              },
              type: 'quantitative',
            },
            text: {
              field: 'name',
            },
          },
          metric: 'sum__num',
          rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
          series: 'name',
        }}
      />
    ),
    storyName: 'encodes font family by first letter',
    storyPath: 'plugin-chart-word-cloud|WordCloudChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="legacy-word-cloud2"
        width={400}
        height={400}
        queryData={{ data }}
        formData={{
          colorScheme: 'd3Category10',
          metric: 'sum__num',
          rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
          series: 'name',
          sizeFrom: '10',
          sizeTo: '70',
        }}
      />
    ),
    storyName: 'Legacy',
    storyPath: 'plugin-chart-word-cloud|WordCloudChartPlugin',
  },
];
