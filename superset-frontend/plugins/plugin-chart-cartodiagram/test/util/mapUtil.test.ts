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

import Map from 'ol/Map.js';
import OSM from 'ol/source/OSM.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import { ChartConfig } from '../../src/types';
import { fitMapToData, wkbToGeoJSON, wktToGeoJSON } from '../../src/util/mapUtil';

describe('mapUtil', () => {
  describe('fitMapToCharts', () => {
    it('changes the center of the map', () => {
      const chartConfig: ChartConfig = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [8.793, 53.04117],
            },
            properties: {
              setDataMask: '',
              labelMap: '',
              labelMapB: '',
              groupby: '',
              selectedValues: '',
              formData: '',
              groupbyB: '',
              seriesBreakdown: '',
              legendData: '',
              echartOptions: '',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [10.61833, 51.8],
            },
            properties: {
              setDataMask: '',
              labelMap: '',
              labelMapB: '',
              groupby: '',
              selectedValues: '',
              formData: '',
              groupbyB: '',
              seriesBreakdown: '',
              legendData: '',
              echartOptions: '',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [6.86883, 50.35667],
            },
            properties: {
              setDataMask: '',
              labelMap: '',
              labelMapB: '',
              groupby: '',
              selectedValues: '',
              formData: '',
              groupbyB: '',
              seriesBreakdown: '',
              legendData: '',
              echartOptions: '',
            },
          },
        ],
      };

      const initialCenter = [0, 0];

      const olMap = new Map({
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        target: 'map',
        view: new View({
          center: initialCenter,
          zoom: 2,
        }),
      });

      // should set center
      fitMapToData(olMap, chartConfig);

      const updatedCenter = olMap.getView().getCenter();

      expect(initialCenter).not.toEqual(updatedCenter);
    });
  });

  describe('wkbToGeoJSON', () => {
    it('converts WKB to GeoJSON', () => {
      const wkb = '0101000020E610000000000000000020400000000000804A40';
      const geoJSON = wkbToGeoJSON(wkb);
      expect(geoJSON).toEqual({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [8, 53],
        },
        properties: null,
      });
    });
  });

  describe('wktToGeoJSON', () => {
    it('converts WKT to GeoJSON', () => {
      const wkt = 'POINT(8 53)';
      const geoJSON = wktToGeoJSON(wkt);
      expect(geoJSON).toEqual({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [8, 53],
        },
        properties: null,
      });
    });

    it('handles SRID in WKT', () => {
      const wkt = 'SRID=4326;POINT(8 53)';
      const geoJSON = wktToGeoJSON(wkt);
      expect(geoJSON).toEqual({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [8, 53],
        },
        properties: null,
      });
    });
  });
});
