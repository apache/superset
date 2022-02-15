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
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { select, withKnobs } from '@storybook/addon-knobs';
import {
  WordCloudChartPlugin,
  LegacyWordCloudChartPlugin,
  WordCloudTransformProps,
} from '@superset-ui/plugin-chart-word-cloud';
import { withResizableChartDemo } from '../../../shared/components/ResizableChartDemo';
import data from './data';

new WordCloudChartPlugin().configure({ key: 'word-cloud2' }).register();
new LegacyWordCloudChartPlugin()
  .configure({ key: 'legacy-word-cloud2' })
  .register();

// Enable the new WordCloud Props to show case its full features
// if the control panel is updated to be able to pass formData in the new format.
getChartTransformPropsRegistry().registerValue(
  'word-cloud2',
  WordCloudTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-word-cloud',
  decorators: [withKnobs, withResizableChartDemo],
};

export const basic = ({ width, height }) => (
  <SuperChart
    chartType="word-cloud2"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        color: {
          value: '#0097e6',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const encodesColorByWordLength = ({ width, height }) => (
  <SuperChart
    chartType="word-cloud2"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        color: {
          field: 'name.length',
          scale: {
            range: ['#fbc531', '#c23616'],
            type: 'linear',
            zero: false,
          },
          type: 'quantitative',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const encodesFontByFirstLetter = ({ width, height }) => (
  <SuperChart
    chartType="word-cloud2"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      encoding: {
        color: {
          value: '#8c7ae6',
        },
        fontFamily: {
          field: 'name[0]',
          scale: {
            range: ['Helvetica', 'Monaco'],
            type: 'ordinal',
          },
          type: 'nominal',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const legacyShim = ({ width, height }) => (
  <SuperChart
    chartType="legacy-word-cloud2"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
      sizeFrom: '10',
      sizeTo: '70',
    }}
  />
);
