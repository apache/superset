import React from 'react';
import { SuperChart } from '@superset-ui/core';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import countries from '@superset-ui/legacy-plugin-chart-country-map/lib/countries';
import { withKnobs, select } from '@storybook/addon-knobs';
import data from './data';

new CountryMapChartPlugin().configure({ key: 'country-map' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-country-map',
  decorators: [withKnobs],
};

export const basic = () => (
  <SuperChart
    chartType="country-map"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      linearColorScheme: 'schemeRdYlBu',
      numberFormat: '.3s',
      selectCountry: select('Country', Object.keys(countries!), 'france', 'country'),
    }}
  />
);
