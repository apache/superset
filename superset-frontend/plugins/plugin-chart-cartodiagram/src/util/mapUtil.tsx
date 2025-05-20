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

/**
 * Util for map related operations.
 */
import { DataRecord } from '@superset-ui/core';
import { Feature, Map } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { ChartConfig } from '../types';
import WKB from 'ol/format/WKB';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { FeatureCollection } from 'geojson';
import { FitOptions } from 'ol/View';
import { getExtentFromFeatures } from './geometryUtil';
import { MapProjections } from '../types';

// default map extent of world if no features are found
// TODO: move to generic config file or plugin configuration
// TODO: adapt to CRS other than Web Mercator
const defaultExtent = [-16000000, -7279000, 20500000, 11000000];

/**
 * Fits map to the spatial extent of provided charts.
 *
 * @param olMap The OpenLayers map
 * @param chartConfigs The chart configuration
 */
export const fitMapToCharts = (olMap: Map, chartConfigs: ChartConfig) => {
  const view = olMap.getView();
  const features = new GeoJSON().readFeatures(chartConfigs, {
    // TODO: adapt to map projection
    featureProjection: 'EPSG:3857',
  });

  const extent = getExtentFromFeatures(features) || defaultExtent;

  view.fit(extent, {
    // tested for a desktop size monitor
    size: [250, 250],
  });
};

const fitToData = (
  olMap: Map,
  features: Feature[],
  padding?: FitOptions['padding'] | undefined,
) => {
  const view = olMap.getView();
  const extent = getExtentFromFeatures(features) || defaultExtent;

  if (padding) {
    view.fit(extent, { padding });
  } else {
    view.fit(extent);
  }
};

/**
 * Create OL Features from data records.
 *
 * @param dataRecords The data records to transform.
 * @param geomColumn The name of the column holding the geodata.
 * @returns List of OL Features.
 */
export const dataRecordsToOlFeatures = (
  dataRecords: DataRecord[],
  geomColumn: string,
) => {
  const wkbFormat = new WKB();
  const features = dataRecords
    .map(item => {
      const { [geomColumn]: wkb, ...props } = item;
      if (typeof wkb !== 'string') {
        return undefined;
      }

      const feature = wkbFormat.readFeature(wkb, {
        featureProjection: 'EPSG:3857',
      });
      feature.setProperties(props);

      return feature;
    })
    .filter(f => f !== undefined);
  return features;
};

/**
 * Fit map to the spatial extent of provided data.
 *
 * @param olMap The OpenLayers map
 * @param featureCollection The feature collection to get the extent from.
 */
export const fitMapToData = (
  olMap: Map,
  featureCollection: FeatureCollection,
  padding?: FitOptions['padding'] | undefined,
) => {
  const features = new GeoJSON().readFeatures(featureCollection, {
    // TODO: adapt to map projection
    featureProjection: 'EPSG:3857',
  });
  fitToData(olMap, features, padding);
};

/**
 * Fit map to the spatial extent of provided data.
 *
 * @param olMap The OpenLayers map
 * @param dataRecords The data records to get the extent from.
 * @param geomColumn The name of the column holding the geodata.
 */
export const fitMapToDataRecords = (
  olMap: Map,
  dataRecords: DataRecord[],
  geomColumn: string,
  padding?: FitOptions['padding'] | undefined,
) => {
  const features = dataRecordsToOlFeatures(
    dataRecords,
    geomColumn,
  ) as Feature[];
  fitToData(olMap, features, padding);
};

/**
 * Register map projections.
 * @param mapProjections The map projections to register.
 */
export const registerMapProjections = (mapProjections: MapProjections) => {
  Object.entries(mapProjections).forEach(([code, definition]) => {
    proj4.defs(code, definition);
  });
  register(proj4);
};
