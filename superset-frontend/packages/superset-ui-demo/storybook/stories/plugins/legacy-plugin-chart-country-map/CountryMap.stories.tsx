import React, { useEffect, useState } from 'react';
import {
  JsonObject,
  seedRandom,
  SuperChart,
  SequentialD3,
  useTheme,
} from '@superset-ui/core';
import CountryMapChartPlugin, {
  countries,
} from '@superset-ui/legacy-plugin-chart-country-map';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

new CountryMapChartPlugin().configure({ key: 'country-map' }).register();

export default {
  title: 'Legacy Chart Plugins/CountryMap',
  component: SuperChart,
  decorators: [withResizableChartDemo],
  args: {
    country: 'france',
    colorSchema: SequentialD3.find(x => x.id === 'schemeOranges')?.id,
  },
  argTypes: {
    country: {
      control: 'select',
      options: Object.keys(countries),
    },
    colorSchema: {
      control: 'select',
      options: SequentialD3.map((x) => x.id),
    },
  },
};

export const BasicCountryMapStory = ({ width, height, country, colorSchema }) => {
  const theme = useTheme();
  const [data, setData] = useState<JsonObject>();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    fetch(countries[country], { signal })
      .then(resp => resp.json())
      .then(geojson => {
        setData(generateData(geojson));
      });
    return () => controller.abort();
  }, [country]);

  if (!data) {
    return (
      <div
        style={{
          color: theme.colors.grayscale.base,
          textAlign: 'center',
          padding: 20,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <SuperChart
      chartType="country-map"
      width={width}
      height={height}
      queriesData={[{ data }]}
      formData={{
        linearColorScheme: colorSchema,
        numberFormat: '.3s',
        selectCountry: country,
      }}
    />
  );
};

function generateData(geojson: JsonObject) {
  return geojson.features.map(feat => ({
    metric: Math.round(seedRandom() * 10000) / 100,
    country_id: feat.properties.ISO,
  }));
}
