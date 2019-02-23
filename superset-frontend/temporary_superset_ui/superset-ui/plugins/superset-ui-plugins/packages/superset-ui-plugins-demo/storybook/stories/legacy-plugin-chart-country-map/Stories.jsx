/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

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
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-country-map|CountryMapChartPlugin',
  },
];
