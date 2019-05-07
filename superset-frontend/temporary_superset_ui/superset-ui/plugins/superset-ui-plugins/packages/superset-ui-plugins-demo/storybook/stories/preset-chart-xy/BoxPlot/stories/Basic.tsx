/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart, ChartProps } from '@superset-ui/chart';
import data from '../data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="v2-box-plot"
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />
    ),
    storyName: 'Basic',
    storyPath: 'preset-chart-xy|BoxPlotChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="v2-box-plot"
        chartProps={
          new ChartProps({
            datasource: { verboseMap: {} },
            formData: {
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
            },
            height: 400,
            payload: { data },
            width: 400,
          })
        }
      />
    ),
    storyName: 'Horizontal',
    storyPath: 'preset-chart-xy|BoxPlotChartPlugin',
  },
];
