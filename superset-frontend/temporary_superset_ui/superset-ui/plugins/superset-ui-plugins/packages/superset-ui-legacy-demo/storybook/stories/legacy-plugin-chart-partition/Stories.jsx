/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="partition"
        chartProps={{
          datasource: {
            verboseMap: {},
          },
          formData: {
            colorScheme: 'd3Category10',
            dateTimeFormat: '%Y-%m-%d',
            equalDateSize: true,
            groupby: ['region', 'country_code'],
            logScale: false,
            metrics: ['sum__SP_POP_TOTL'],
            numberFormat: '.3s',
            partitionLimit: '5',
            partitionThreshold: '0.05',
            richTooltip: true,
            timeSeriesOption: 'not-time',
          },
          height: 400,
          payload: {
            data: [
              {
                name: 'World',
                val: 165709793794.0,
                children: [
                  {
                    name: 'East Asia & Pacific',
                    val: 74157936990.0,
                    children: [
                      {
                        name: 'CHN',
                        val: 58345455000.0,
                        children: [],
                      },
                      {
                        name: 'IDN',
                        val: 9357861231.0,
                        children: [],
                      },
                      {
                        name: 'JPN',
                        val: 6454620759.0,
                        children: [],
                      },
                    ],
                  },
                  {
                    name: 'Europe & Central Asia',
                    val: 7667188460.0,
                    children: [
                      {
                        name: 'RUS',
                        val: 7667188460.0,
                        children: [],
                      },
                    ],
                  },
                  {
                    name: 'Latin America & Caribbean',
                    val: 7752058955.0,
                    children: [
                      {
                        name: 'BRA',
                        val: 7752058955.0,
                        children: [],
                      },
                    ],
                  },
                  {
                    name: 'North America',
                    val: 13604468357.0,
                    children: [
                      {
                        name: 'USA',
                        val: 13604468357.0,
                        children: [],
                      },
                    ],
                  },
                  {
                    name: 'South Asia',
                    val: 57268340539.0,
                    children: [
                      {
                        name: 'BGD',
                        val: 5549261462.0,
                        children: [],
                      },
                      {
                        name: 'IND',
                        val: 46023037597.0,
                        children: [],
                      },
                      {
                        name: 'PAK',
                        val: 5696041480.0,
                        children: [],
                      },
                    ],
                  },
                  {
                    name: 'Sub-Saharan Africa',
                    val: 5259800493.0,
                    children: [
                      {
                        name: 'NGA',
                        val: 5259800493.0,
                        children: [],
                      },
                    ],
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
    storyPath: 'plugin-chart-partition|PartitionChartPlugin',
  },
];
