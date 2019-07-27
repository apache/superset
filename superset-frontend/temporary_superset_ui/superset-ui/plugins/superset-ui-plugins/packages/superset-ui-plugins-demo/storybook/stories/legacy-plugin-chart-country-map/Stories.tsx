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
        width={400}
        height={400}
        payload={{ data }}
        formData={{
          linearColorScheme: 'schemeRdYlBu',
          numberFormat: '.3s',
          selectCountry: select('Country', Object.keys(countries!), 'france', 'country'),
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-country-map|CountryMapChartPlugin',
  },
];
