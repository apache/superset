/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="country-map"
        chartProps={{
          formData: {
            linearColorScheme: 'schemeRdYlBu',
            numberFormat: '.3s',
            selectCountry: 'France',
          },
          height: 400,
          payload: {
            data: [
              {
                country_id: 'FR-01',
                metric: 2004.0,
              },
              {
                country_id: 'FR-02',
                metric: 2004.0,
              },
              {
                country_id: 'FR-03',
                metric: 2004.0,
              },
              {
                country_id: 'FR-04',
                metric: 2004.0,
              },
              {
                country_id: 'FR-05',
                metric: 2004.0,
              },
              {
                country_id: 'FR-06',
                metric: 2004.0,
              },
              {
                country_id: 'FR-07',
                metric: 2004.0,
              },
              {
                country_id: 'FR-08',
                metric: 2004.0,
              },
              {
                country_id: 'FR-09',
                metric: 2004.0,
              },
              {
                country_id: 'FR-10',
                metric: 2004.0,
              },
              {
                country_id: 'FR-11',
                metric: 2004.0,
              },
              {
                country_id: 'FR-12',
                metric: 2004.0,
              },
              {
                country_id: 'FR-13',
                metric: 2004.0,
              },
              {
                country_id: 'FR-14',
                metric: 2004.0,
              },
              {
                country_id: 'FR-15',
                metric: 2004.0,
              },
              {
                country_id: 'FR-16',
                metric: 2004.0,
              },
              {
                country_id: 'FR-17',
                metric: 2004.0,
              },
              {
                country_id: 'FR-18',
                metric: 2004.0,
              },
              {
                country_id: 'FR-19',
                metric: 2004.0,
              },
              {
                country_id: 'FR-21',
                metric: 2004.0,
              },
              {
                country_id: 'FR-22',
                metric: 2004.0,
              },
              {
                country_id: 'FR-23',
                metric: 2004.0,
              },
              {
                country_id: 'FR-24',
                metric: 2004.0,
              },
              {
                country_id: 'FR-25',
                metric: 2004.0,
              },
              {
                country_id: 'FR-26',
                metric: 2004.0,
              },
              {
                country_id: 'FR-27',
                metric: 2004.0,
              },
              {
                country_id: 'FR-28',
                metric: 2004.0,
              },
              {
                country_id: 'FR-29',
                metric: 2004.0,
              },
              {
                country_id: 'FR-2A',
                metric: 2004.0,
              },
              {
                country_id: 'FR-2B',
                metric: 2004.0,
              },
              {
                country_id: 'FR-30',
                metric: 2004.0,
              },
              {
                country_id: 'FR-31',
                metric: 2004.0,
              },
              {
                country_id: 'FR-32',
                metric: 2004.0,
              },
              {
                country_id: 'FR-33',
                metric: 2004.0,
              },
              {
                country_id: 'FR-34',
                metric: 200.0,
              },
              {
                country_id: 'FR-35',
                metric: 2004.0,
              },
              {
                country_id: 'FR-36',
                metric: 2004.0,
              },
              {
                country_id: 'FR-37',
                metric: 2004.0,
              },
              {
                country_id: 'FR-38',
                metric: 2004.0,
              },
              {
                country_id: 'FR-39',
                metric: 2004.0,
              },
              {
                country_id: 'FR-40',
                metric: 2004.0,
              },
              {
                country_id: 'FR-41',
                metric: 2004.0,
              },
              {
                country_id: 'FR-42',
                metric: 2004.0,
              },
              {
                country_id: 'FR-43',
                metric: 2004.0,
              },
              {
                country_id: 'FR-44',
                metric: 2004.0,
              },
              {
                country_id: 'FR-45',
                metric: 2004.0,
              },
              {
                country_id: 'FR-46',
                metric: 2004.0,
              },
              {
                country_id: 'FR-47',
                metric: 2004.0,
              },
              {
                country_id: 'FR-48',
                metric: 2004.0,
              },
              {
                country_id: 'FR-49',
                metric: 2004.0,
              },
              {
                country_id: 'FR-50',
                metric: 2004.0,
              },
              {
                country_id: 'FR-51',
                metric: 2004.0,
              },
              {
                country_id: 'FR-52',
                metric: 2004.0,
              },
              {
                country_id: 'FR-53',
                metric: 2004.0,
              },
              {
                country_id: 'FR-54',
                metric: 2004.0,
              },
              {
                country_id: 'FR-55',
                metric: 2004.0,
              },
              {
                country_id: 'FR-56',
                metric: 2004.0,
              },
              {
                country_id: 'FR-57',
                metric: 2004.0,
              },
              {
                country_id: 'FR-58',
                metric: 2004.0,
              },
              {
                country_id: 'FR-59',
                metric: 2004.0,
              },
              {
                country_id: 'FR-60',
                metric: 2004.0,
              },
              {
                country_id: 'FR-61',
                metric: 2004.0,
              },
              {
                country_id: 'FR-62',
                metric: 2004.0,
              },
              {
                country_id: 'FR-63',
                metric: 2004.0,
              },
              {
                country_id: 'FR-64',
                metric: 2004.0,
              },
              {
                country_id: 'FR-65',
                metric: 2004.0,
              },
              {
                country_id: 'FR-66',
                metric: 2004.0,
              },
              {
                country_id: 'FR-67',
                metric: 2004.0,
              },
              {
                country_id: 'FR-68',
                metric: 2004.0,
              },
              {
                country_id: 'FR-69',
                metric: 2004.0,
              },
              {
                country_id: 'FR-70',
                metric: 2004.0,
              },
              {
                country_id: 'FR-71',
                metric: 2004.0,
              },
              {
                country_id: 'FR-72',
                metric: 2004.0,
              },
              {
                country_id: 'FR-73',
                metric: 2004.0,
              },
              {
                country_id: 'FR-74',
                metric: 2004.0,
              },
              {
                country_id: 'FR-75',
                metric: 2004.0,
              },
              {
                country_id: 'FR-76',
                metric: 2004.0,
              },
              {
                country_id: 'FR-77',
                metric: 2004.0,
              },
              {
                country_id: 'FR-78',
                metric: 2004.0,
              },
              {
                country_id: 'FR-79',
                metric: 2004.0,
              },
              {
                country_id: 'FR-80',
                metric: 2004.0,
              },
              {
                country_id: 'FR-81',
                metric: 2004.0,
              },
              {
                country_id: 'FR-82',
                metric: 2004.0,
              },
              {
                country_id: 'FR-83',
                metric: 2004.0,
              },
              {
                country_id: 'FR-84',
                metric: 2004.0,
              },
              {
                country_id: 'FR-85',
                metric: 2004.0,
              },
              {
                country_id: 'FR-86',
                metric: 2004.0,
              },
              {
                country_id: 'FR-87',
                metric: 2004.0,
              },
              {
                country_id: 'FR-88',
                metric: 2004.0,
              },
              {
                country_id: 'FR-89',
                metric: 2004.0,
              },
              {
                country_id: 'FR-90',
                metric: 2004.0,
              },
              {
                country_id: 'FR-91',
                metric: 2004.0,
              },
              {
                country_id: 'FR-92',
                metric: 2004.0,
              },
              {
                country_id: 'FR-93',
                metric: 2004.0,
              },
              {
                country_id: 'FR-94',
                metric: 2004.0,
              },
              {
                country_id: 'FR-95',
                metric: 2004.0,
              },
            ],
          },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'plugin-chart-country-map|CountryMapChartPlugin',
  },
];
