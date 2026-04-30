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
import WKB from 'ol/format/WKB';
import WKT from 'ol/format/WKT';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { FeatureCollection } from 'geojson';
import { FitOptions } from 'ol/View';
import { getExtentFromFeatures } from './geometryUtil';
import { ChartConfig, MapProjections } from '../types';
import { GeometryFormat } from '../constants';

// default map extent of world if no features are found
// TODO: move to generic config file or plugin configuration
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

const extractSridFromWkt = (wkt: string) => {
  const extract: { geom: string; srid: string | null } = {
    geom: wkt,
    srid: null,
  };
  if (wkt.startsWith('SRID=')) {
    // WKT with SRID, strip it
    const srid = wkt.match(/SRID=(\d+);/);
    if (srid) {
      extract.srid = `EPSG:${srid[1]}`;
      extract.geom = wkt.replace(/SRID=\d+;/, '');
    }
  }
  return extract;
};

export const wkbToGeoJSON = (wkb: string) => {
  const format = new WKB();
  const feature = format.readFeature(wkb, {
    featureProjection: 'EPSG:3857',
  });
  return new GeoJSON().writeFeatureObject(feature, {
    featureProjection: 'EPSG:3857',
  });
};

export const wktToGeoJSON = (wkt: string) => {
  const format = new WKT();
  const wktOpts: any = {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326', // default to WGS84
  };
  const extract = extractSridFromWkt(wkt);
  const cleanedWkt = extract.geom;
  if (extract.srid) {
    wktOpts.dataProjection = extract.srid;
  }
  const feature = format.readFeature(cleanedWkt, wktOpts);
  return new GeoJSON().writeFeatureObject(feature, {
    featureProjection: 'EPSG:3857',
  });
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
  geomFormat: GeometryFormat.WKB | GeometryFormat.WKT,
) => {
  let format: WKB | WKT = new WKB();

  if (geomFormat === GeometryFormat.WKT) {
    format = new WKT();
  }
  const features = dataRecords
    .map(item => {
      const geom = item[geomColumn];
      if (typeof geom !== 'string') {
        return undefined;
      }

      let cleanedGeom = geom;
      const opts: any = {
        featureProjection: 'EPSG:3857',
      };
      if (geomFormat === GeometryFormat.WKT) {
        const extract = extractSridFromWkt(geom);
        cleanedGeom = extract.geom;
        if (extract.srid) {
          opts.dataProjection = extract.srid;
        }
      }
      const feature = format.readFeature(cleanedGeom, opts);
      feature.setProperties({ ...item });

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
 * @param geomFormat The format of the geometry column.
 * @param padding Optional padding for the fit operation.
 */
export const fitMapToDataRecords = (
  olMap: Map,
  dataRecords: DataRecord[],
  geomColumn: string,
  geomFormat: GeometryFormat.WKB | GeometryFormat.WKT,
  padding?: FitOptions['padding'] | undefined,
) => {
  const features = dataRecordsToOlFeatures(
    dataRecords,
    geomColumn,
    geomFormat,
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
