/*
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

import React from 'react';
import { SuperChart } from '@superset-ui/core';
import { withKnobs, select } from '@storybook/addon-knobs';
import {
  maps,
  ChoroplethMapChartPlugin,
} from '@superset-ui/plugin-chart-choropleth-map';
import useFakeMapData from './useFakeMapData';

new ChoroplethMapChartPlugin().configure({ key: 'choropleth-map' }).register();

export default {
  title: 'Chart Plugins|plugin-chart-choropleth-map',
  decorators: [withKnobs],
};

export const WorldMap = () => {
  const map = select(
    'Map',
    maps.map(m => m.key),
    'world',
    'map',
  );

  return (
    <SuperChart
      chartType="choropleth-map"
      width={800}
      height={450}
      queriesData={[{ data: useFakeMapData(map) }]}
      formData={{
        map,
        encoding: {
          key: {
            field: 'key',
            title: 'Location',
          },
          fill: {
            type: 'quantitative',
            field: 'numStudents',
            scale: {
              range: ['#cecee5', '#3f007d'],
            },
          },
        },
      }}
    />
  );
};

export const USA = () => (
  <SuperChart
    chartType="choropleth-map"
    width={800}
    height={450}
    queriesData={[{ data: useFakeMapData('usa') }]}
    formData={{
      map: 'usa',
      encoding: {
        key: {
          field: 'key',
          title: 'State',
        },
        fill: {
          type: 'quantitative',
          field: 'numStudents',
          title: 'No. of students',
          scale: {
            range: ['#fdc28c', '#7f2704'],
          },
        },
        tooltip: [
          {
            field: 'favoriteFruit',
            title: 'Fruit',
          },
        ],
      },
    }}
  />
);

export const CategoricalColor = () => (
  <SuperChart
    chartType="choropleth-map"
    width={800}
    height={450}
    queriesData={[{ data: useFakeMapData('usa') }]}
    formData={{
      map: 'usa',
      encoding: {
        key: {
          field: 'key',
          title: 'State',
        },
        fill: {
          type: 'nominal',
          field: 'favoriteFruit',
          scale: {
            domain: ['apple', 'banana', 'grape'],
            range: ['#e74c3c', '#f1c40f', '#9b59b6'],
          },
        },
      },
    }}
  />
);
