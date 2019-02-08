/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="treemap"
        chartProps={{
          formData: {
            colorScheme: 'd3Category10',
            numberFormat: '.3s',
            treeMapRatio: 1.618033988749895,
          },
          height: 400,
          payload: {
            data: [
              {
                name: 'Total Population',
                children: [
                  {
                    name: 'East Asia & Pacific',
                    value: 92886288081,
                  },
                  {
                    name: 'South Asia',
                    value: 60081663698,
                  },
                  {
                    name: 'Europe & Central Asia',
                    value: 44338871387,
                  },
                  {
                    name: 'Sub-Saharan Africa',
                    value: 28161513610,
                  },
                  {
                    name: 'Latin America & Caribbean',
                    value: 23202014769,
                  },
                  {
                    name: 'North America',
                    value: 15077904555,
                  },
                  {
                    name: 'Middle East & North Africa',
                    value: 13187931450,
                  },
                ],
              },
            ],
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-treemap|TreemapChartPlugin',
  },
];
