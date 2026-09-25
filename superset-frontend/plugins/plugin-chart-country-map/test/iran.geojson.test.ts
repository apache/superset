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

type Feature = {
  properties: {
    ISO: string;
    NAME_1: string;
  };
};

// `.geojson` imports are mocked out to an empty object by the Jest module
// mapper (see jest.config.js), so the file is read from disk directly to
// exercise the real, committed data.
function loadIranGeoJson(): { features: Feature[] } {
  const filePath = path.join(__dirname, '../src/countries/iran.geojson');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

test('every Iranian province has its own distinct ISO 3166-2 code', () => {
  const { features } = loadIranGeoJson();

  // Pin the feature count too, so dropping a province other than
  // Tehran/Alborz (which would still leave every remaining ISO code
  // distinct) doesn't slip past the checks below.
  expect(features.length).toBe(31);

  // Sanity check: every province name in this file is unique, so a
  // duplicate ISO code below can only mean two different provinces were
  // mistakenly assigned the same code (as opposed to one province being
  // split across multiple polygon features).
  const names = features.map(feature => feature.properties.NAME_1);
  expect(new Set(names).size).toBe(names.length);

  const isoByName = new Map(
    features.map(feature => [
      feature.properties.NAME_1,
      feature.properties.ISO,
    ]),
  );
  const isoCodes = features.map(feature => feature.properties.ISO);

  expect(new Set(isoCodes).size).toBe(isoCodes.length);

  // Tehran and Alborz were split into separate provinces in 2010, but the
  // GeoJSON still assigned both the same ISO code (IR-07), which used to
  // make it impossible to distinguish them on the Country Map chart. Alborz
  // now uses its pre-2020 ISO 3166-2 code, IR-32.
  expect(isoByName.get('Tehran')).toBe('IR-07');
  expect(isoByName.get('Alborz')).toBe('IR-32');
});
