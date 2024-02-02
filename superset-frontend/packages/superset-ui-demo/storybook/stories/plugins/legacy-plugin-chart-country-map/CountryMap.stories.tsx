User
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
import { withKnobs, select } from '@storybook/addon-knobs';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

new CountryMapChartPlugin().configure({ key: 'country-map' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-country-map',
  decorators: [withKnobs, withResizableChartDemo],
};

function generateData(geojson: JsonObject) {
  return geojson.features.map(feat => ({
    metric: Math.round(seedRandom() * 10000) / 100,
    country_id: feat.properties.ISO,
  }));
}

export const basic = function BasicCountryMapStory({ width, height }) {
  const theme = useTheme();
  const country = select('Country', Object.keys(countries!), 'france');
  const colorSchema = select<any>(
    'Color schema',
    SequentialD3,
    SequentialD3.find(x => x.id === 'schemeOranges'),
  );
  const [data, setData] = useState<JsonObject>();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    fetch(countries[country], { signal })
      .then(resp => resp.json())
      .then(geojson => {
        setData(generateData(geojson));
      });
    return () => {
      controller.abort();
    };
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
        linearColorScheme: colorSchema.id,
        numberFormat: '.3s',
        selectCountry: country,
      }}
    />
  );
};


// import React, { useState, useEffect } from 'react';
// import { JsonObject, SuperChart, useTheme, SequentialD3 } from '@superset-ui/core';
// import CountryMapChartPlugin, { countries } from '@superset-ui/legacy-plugin-chart-country-map';
// import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';

// // Ensure the CountryMapChartPlugin is registered
// new CountryMapChartPlugin().configure({ key: 'country-map' }).register();

// export default {
//   title: 'Legacy Chart Plugins/CountryMap',
//   component: SuperChart,
//   decorators: [withResizableChartDemo],
//   parameters: {
//     initialSize: { width: 500, height: 300 },
//   },
//   args: {
//     country: 'france',
//     colorSchema: SequentialD3.find(x => x.id === 'schemeOranges')?.id,
//   },
//   argTypes: {
//     country: {
//       control: 'select',
//       options: Object.keys(countries),
//     },
//     colorSchema: {
//       control: 'select',
//       options: SequentialD3.map((x) => x.id),
//     },
//   },
// };

// export const BasicCountryMapStory = (args) => <BasicCountryMap {...args} />;

// const BasicCountryMap = ({ width, height, country = 'finland', colorSchema = SequentialD3.find(x => x.id === 'schemeOranges')?.id }) => {
//   // const theme = useTheme();
//   const [data, setData] = useState<JsonObject>();

//   console.log(`Width: ${width}, Height: ${height}`, `Country: ${country}`, `Color Schema: ${colorSchema}`);

//   // Simplified data generation for demonstration
//   const generateData = (geojson: JsonObject) => {
//     return geojson.features.map((feat) => ({
//       metric: Math.round(Math.random() * 10000) / 100,
//       country_id: feat.properties.ISO,
//     }));
//   };

//   useEffect(() => {
//     // Assuming fetched data for simplicity
//     // You should replace this with actual fetching logic based on `country`
//     const geojson = { features: [{ properties: { ISO: countries[country] } }] }; // Adjust this line according to your actual data fetching
//     const newData = generateData(geojson);
//     setData(newData);
//   }, [country]); // Re-fetch/generate data when `country` changes

//   if (!data) {
//     return <div>Loading...</div>;
//   }

//   return (
//     <SuperChart
//       chartType="country-map"
//       width={width}
//       height={height}
//       queriesData={[{ data }]}
//       formData={{
//         linearColorScheme: colorSchema,
//         numberFormat: '.3s',
//         selectCountry: country,
//       }}
//     />
//   );
// };

// BasicCountryMapStory.args = {
//   country: 'france',
//   colorSchema: SequentialD3.find(x => x.id === 'schemeOranges')?.id,
// };




