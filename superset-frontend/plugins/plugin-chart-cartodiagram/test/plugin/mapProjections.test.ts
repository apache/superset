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

import { GeometryFormat } from '../../src/constants';

const EPSG_25832 =
  '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

const seedBootstrapData = (mapProjections: Record<string, string>) => {
  // spec/helpers/setup.ts already creates #app, and getElementById returns the first match.
  document.getElementById('app')!.setAttribute(
    'data-bootstrap',
    JSON.stringify({
      common: {
        conf: { MAP_PROJECTIONS: mapProjections, MAP_DEFAULT_LAYERS: [] },
      },
    }),
  );
};

// Fresh registry per call: the bootstrap cache and the proj4/ol projection registries are module state.
const loadModules = () => {
  let CartodiagramPlugin: typeof import('../../src/plugin').default;
  let mapUtil: typeof import('../../src/util/mapUtil');
  let toLonLat: typeof import('ol/proj').toLonLat;
  jest.isolateModules(() => {
    CartodiagramPlugin = require('../../src/plugin').default;
    mapUtil = require('../../src/util/mapUtil');
    toLonLat = require('ol/proj').toLonLat;
  });
  return {
    CartodiagramPlugin: CartodiagramPlugin!,
    mapUtil: mapUtil!,
    toLonLat: toLonLat!,
  };
};

afterEach(() => {
  document.getElementById('app')?.setAttribute('data-bootstrap', '');
});

test('plugin registers MAP_PROJECTIONS from bootstrap data for SRID-tagged WKT', () => {
  seedBootstrapData({ 'EPSG:25832': EPSG_25832 });
  const { CartodiagramPlugin, mapUtil } = loadModules();
  // eslint-disable-next-line no-new
  new CartodiagramPlugin();

  const feature = mapUtil.wktToGeoJSON('SRID=25832;POINT(500000 0)');
  expect(feature?.geometry.type).toBe('Point');
  const [lon, lat] = (feature!.geometry as { coordinates: number[] })
    .coordinates;
  expect(lon).toBeCloseTo(9, 5);
  expect(lat).toBeCloseTo(0, 5);
});

test('plugin registers MAP_PROJECTIONS for features built from data records', () => {
  seedBootstrapData({ 'EPSG:25832': EPSG_25832 });
  const { CartodiagramPlugin, mapUtil, toLonLat } = loadModules();
  // eslint-disable-next-line no-new
  new CartodiagramPlugin();

  const [feature] = mapUtil.dataRecordsToOlFeatures(
    [{ geom: 'SRID=25832;POINT(500000 0)' }],
    'geom',
    GeometryFormat.WKT,
  );
  const [lon, lat] = toLonLat(
    (
      feature.getGeometry() as unknown as { getCoordinates(): number[] }
    ).getCoordinates(),
  );
  expect(lon).toBeCloseTo(9, 5);
  expect(lat).toBeCloseTo(0, 5);
});
