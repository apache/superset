/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="sankey"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
          },
          height: 400,
          payload: {
            data: [
              {
                source: 'Energy',
                target: 'Electricity and heat',
                value: 24.9,
              },
              {
                source: 'Energy',
                target: 'Industry',
                value: 14.7,
              },
              {
                source: 'Energy',
                target: 'Transportation',
                value: 14.3,
              },
              {
                source: 'Deforestation',
                target: 'Carbon Dioxide',
                value: 10.9,
              },
              {
                source: 'Land Use Change',
                target: 'Deforestation',
                value: 10.9,
              },
              {
                source: 'Road',
                target: 'Carbon Dioxide',
                value: 10.5,
              },
              {
                source: 'Transportation',
                target: 'Road',
                value: 10.5,
              },
              {
                source: 'Residential Buildings',
                target: 'Carbon Dioxide',
                value: 10.2,
              },
              {
                source: 'Energy',
                target: 'Other Fuel Combustion',
                value: 8.6,
              },
              {
                source: 'Other Industry',
                target: 'Carbon Dioxide',
                value: 6.6,
              },
            ],
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-sankey|SankeyChartPlugin',
  },
];
