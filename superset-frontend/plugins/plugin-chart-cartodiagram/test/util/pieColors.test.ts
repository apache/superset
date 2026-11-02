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

import {
  CategoricalColorNamespace,
  CategoricalScheme,
  ChartProps,
  DataRecord,
  getCategoricalSchemeRegistry,
  getLabelsColorMap,
  LabelsColorMapSource,
  SqlaFormData,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import pieTransform from '../../../plugin-chart-echarts/src/Pie/transformProps';
import { EchartsPieChartProps } from '../../../plugin-chart-echarts/src/Pie/types';
import { getChartConfigs } from '../../src/util/transformPropsUtil';

const palette = ['#112233', '#445566', '#778899', '#aabbcc'];
const alternatePalette = ['#110000', '#220000', '#330000', '#440000'];
const locations = [
  JSON.stringify({ type: 'Point', coordinates: [10, 51] }),
  JSON.stringify({ type: 'Point', coordinates: [9, 50] }),
];
const data = [
  { geom: locations[0], cat: 'bar', total: 1 },
  { geom: locations[0], cat: 'baz', total: 1 },
  { geom: locations[1], cat: 'far', total: 1 },
  { geom: locations[1], cat: 'faz', total: 1 },
];
const params: SqlaFormData = {
  viz_type: 'pie',
  datasource: '1__table',
  slice_id: 1,
  groupby: ['cat'],
  metric: 'total',
  color_scheme: 'cartodiagram-test',
};
const labelsColorMap = getLabelsColorMap();
const previousSource = labelsColorMap.source;

beforeAll(() => {
  getCategoricalSchemeRegistry()
    .registerValue(
      'cartodiagram-test',
      new CategoricalScheme({ id: 'cartodiagram-test', colors: palette }),
    )
    .registerValue(
      'cartodiagram-alternate',
      new CategoricalScheme({
        id: 'cartodiagram-alternate',
        colors: alternatePalette,
      }),
    );
});
beforeEach(() => {
  labelsColorMap.reset();
  labelsColorMap.source = LabelsColorMapSource.Explore;
});
afterEach(() => {
  labelsColorMap.reset();
  labelsColorMap.source = previousSource;
  CategoricalColorNamespace.getNamespace().resetColors();
});
afterAll(() => {
  getCategoricalSchemeRegistry()
    .remove('cartodiagram-test')
    .remove('cartodiagram-alternate');
});

/** Transform actual Pie charts through the Cartodiagram grouping boundary. */
function transform(
  rows: DataRecord[] = data,
  colorScheme = params.color_scheme,
) {
  const formData = { ...params, color_scheme: colorScheme };
  const props = new ChartProps({
    theme: supersetTheme,
    queriesData: [
      {
        colnames: ['geom', 'cat', 'total'],
        coltypes: [1, 1, 0],
        data: rows,
      },
    ],
  });
  return getChartConfigs(
    { viz_type: 'pie', params: formData },
    'geom',
    props,
    (child: EchartsPieChartProps) => pieTransform(child),
  ).features.map(feature => {
    const options = feature.properties.echartOptions as {
      series: { data: { name: string; itemStyle: { color: string } }[] }[];
    };
    return options.series[0].data.map(item => ({
      name: item.name,
      color: item.itemStyle.color,
    }));
  });
}

test('assigns distinct colors to different categories across locations in Explore', () => {
  const groups = transform();
  expect(groups.map(group => group.map(item => item.name))).toEqual([
    ['bar', 'baz'],
    ['far', 'faz'],
  ]);
  expect(groups.flat().map(item => item.color)).toEqual(palette);
});

test('keeps repeated categories consistent when their order differs between locations', () => {
  const groups = transform([
    ...data.slice(0, 2),
    { geom: locations[1], cat: 'baz', total: 1 },
    { geom: locations[1], cat: 'bar', total: 1 },
  ]);
  expect(groups[1]).toEqual([groups[0][1], groups[0][0]]);
});

test('starts a fresh scale for a separate Cartodiagram transformation', () => {
  transform();
  expect(transform(data.slice(2))[0].map(item => item.color)).toEqual(
    palette.slice(0, 2),
  );
});

test('uses the selected Pie palette after it changes', () => {
  transform();
  expect(
    transform(data, 'cartodiagram-alternate')
      .flat()
      .map(item => item.color),
  ).toEqual(alternatePalette);
});

test('preserves explicit label colors', () => {
  CategoricalColorNamespace.getNamespace().setColor('far', '#abcdef');
  expect(transform()[1][0]).toEqual({ name: 'far', color: '#abcdef' });
});

test('preserves existing Dashboard label colors', () => {
  labelsColorMap.source = LabelsColorMapSource.Dashboard;
  labelsColorMap.colorMap.set('bar', '#abcdef');
  labelsColorMap.colorMap.set('far', '#fedcba');
  const groups = transform();
  expect(groups[0][0]).toEqual({ name: 'bar', color: '#abcdef' });
  expect(groups[1][0]).toEqual({ name: 'far', color: '#fedcba' });
});

test('returns no charts for an empty query result', () => {
  expect(transform([])).toEqual([]);
});

test('keeps standalone Pie charts on their own selected palette', () => {
  transform();
  const props = new ChartProps({
    theme: supersetTheme,
    formData: params,
    queriesData: [{ data: data.slice(2) }],
  });
  const options = pieTransform(props as EchartsPieChartProps).echartOptions as {
    series: { data: { itemStyle: { color: string } }[] }[];
  };
  expect(options.series[0].data.map(item => item.itemStyle.color)).toEqual(
    palette.slice(0, 2),
  );
});

test('retains existing Dashboard colors when different labels already share a color', () => {
  labelsColorMap.source = LabelsColorMapSource.Dashboard;
  labelsColorMap.colorMap.set('bar', palette[0]);
  labelsColorMap.colorMap.set('far', palette[0]);
  const thirdLocation = JSON.stringify({ type: 'Point', coordinates: [8, 49] });
  const groups = transform([
    data[0],
    data[2],
    { geom: thirdLocation, cat: 'bar', total: 1 },
  ]);
  expect(groups.flat().map(item => item.color)).toEqual([
    palette[0],
    palette[0],
    palette[0],
  ]);
  expect(labelsColorMap.colorMap.get('bar')).toBe(palette[0]);
  expect(labelsColorMap.colorMap.get('far')).toBe(palette[0]);
});
