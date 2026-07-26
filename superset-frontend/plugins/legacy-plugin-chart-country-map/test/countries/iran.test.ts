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
import fs from 'fs';
import path from 'path';

// The geojson is loaded via fs rather than a normal import because the
// webpack/jest loaders treat *.geojson as an opaque asset (a URL string in
// the browser build, an empty mock object under jest), so neither exposes
// the actual feature data to a unit test.
const iranGeojsonPath = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'countries',
  'iran.geojson',
);

type IranFeature = {
  properties: { ISO: string; NAME_1: string };
};

const getIranFeatures = (): IranFeature[] =>
  JSON.parse(fs.readFileSync(iranGeojsonPath, 'utf-8')).features;

test('every province in the Iran map has a unique ISO code', () => {
  const isoCodes = getIranFeatures().map(feature => feature.properties.ISO);
  const uniqueIsoCodes = new Set(isoCodes);
  expect(uniqueIsoCodes.size).toBe(isoCodes.length);
});

test('Tehran, Alborz and Razavi Khorasan have their correct, distinct ISO codes', () => {
  const provincesByIso = Object.fromEntries(
    getIranFeatures().map(feature => [
      feature.properties.NAME_1,
      feature.properties.ISO,
    ]),
  );

  expect(provincesByIso.Tehran).toBe('IR-07');
  expect(provincesByIso.Alborz).toBe('IR-30');
  expect(provincesByIso['Razavi Khorasan']).toBe('IR-09');
});
