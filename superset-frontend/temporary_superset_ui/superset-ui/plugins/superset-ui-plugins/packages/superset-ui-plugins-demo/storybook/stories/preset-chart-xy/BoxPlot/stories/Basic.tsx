/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from '../data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="v2-box-plot"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          encoding: {
            x: {
              type: 'nominal',
              field: 'label',
              scale: {
                type: 'band',
                paddingInner: 0.15,
                paddingOuter: 0.3,
              },
              axis: {
                label: 'Region',
              },
            },
            y: {
              field: 'value',
              type: 'quantitative',
              scale: {
                type: 'linear',
              },
              axis: {
                label: 'Population',
                numTicks: 5,
              },
            },
            color: {
              type: 'nominal',
              field: 'label',
              scale: {
                scheme: 'd3Category10',
              },
            },
          },
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-xy|BoxPlotChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="v2-box-plot"
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          encoding: {
            y: {
              type: 'nominal',
              field: 'label',
              scale: {
                type: 'band',
                paddingInner: 0.15,
                paddingOuter: 0.3,
              },
              axis: {
                label: 'Region',
              },
            },
            x: {
              field: 'value',
              type: 'quantitative',
              scale: {
                type: 'linear',
              },
              axis: {
                label: 'Population',
                numTicks: 5,
              },
            },
            color: {
              type: 'nominal',
              field: 'label',
              scale: {
                scheme: 'd3Category10',
              },
            },
          },
        }}
      />
    ),
    storyName: 'Horizontal',
    storyPath: 'preset-chart-xy|BoxPlotChartPlugin',
  },
];
