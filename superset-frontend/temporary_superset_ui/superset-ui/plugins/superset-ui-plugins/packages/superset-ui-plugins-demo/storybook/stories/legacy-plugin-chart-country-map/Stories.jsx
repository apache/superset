/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import { select } from '@storybook/addon-knobs';
import data from './data';
import countries from '../../../../superset-ui-legacy-plugin-chart-country-map/lib/countries';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="country-map"
        chartProps={{
          formData: {
            linearColorScheme: 'schemeRdYlBu',
            numberFormat: '.3s',
            selectCountry: select('Country', Object.keys(countries), 'france', 'country'),
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
