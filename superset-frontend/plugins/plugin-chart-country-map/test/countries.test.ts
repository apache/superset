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
import { countryOptions } from '../src/countries';

type ItalyFeature = { properties: { ISO: string; NAME_1: string } };

test('countryOptions includes labeled entries for the Italy region variants', () => {
  expect(countryOptions).toContainEqual(['italy_regions', 'Italy (regions)']);
  expect(countryOptions).toContainEqual([
    'italy_regions_and_autonomous_provinces',
    'Italy (regions and autonomous provinces)',
  ]);
});

test('italy_regions_and_autonomous_provinces geojson has the expected shape', () => {
  // jest maps `.geojson` imports to an empty object mock, so the file is
  // read from disk directly to verify its actual shape.
  const geojsonPath = path.join(
    __dirname,
    '../src/countries/italy_regions_and_autonomous_provinces.geojson',
  );
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
  const features: ItalyFeature[] = geojson.features;

  expect(features).toHaveLength(21);
  features.forEach(feature => {
    expect(feature.properties).toEqual(
      expect.objectContaining({
        ISO: expect.any(String),
        NAME_1: expect.any(String),
      }),
    );
  });

  const isoCodes = features.map(feature => feature.properties.ISO);
  expect(new Set(isoCodes).size).toBe(isoCodes.length);
  expect(isoCodes).toContain('IT-BZ');
  expect(isoCodes).toContain('IT-TN');
  expect(isoCodes).not.toContain('IT-32');
});
