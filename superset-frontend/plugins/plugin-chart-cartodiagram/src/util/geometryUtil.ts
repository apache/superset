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
 * Util for geometry related operations.
 */

import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import { Point as OlPoint } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import { Point as GeoJsonPoint } from 'geojson';

/**
 * Extracts the coordinate from a Point GeoJSON in the current map projection.
 *
 * @param geoJsonPoint The GeoJSON string for the point
 *
 * @returns The coordinate
 */
export const getProjectedCoordinateFromPointGeoJson = (
  geoJsonPoint: GeoJsonPoint,
) => {
  const geom: OlPoint = new GeoJSON().readGeometry(geoJsonPoint, {
    // TODO: adapt to map projection
    featureProjection: 'EPSG:3857',
  }) as OlPoint;
  return geom.getCoordinates();
};

/**
 * Computes the extent for an array of features.
 *
 * @param features An Array of OpenLayers features
 * @returns The OpenLayers extent or undefined
 */
export const getExtentFromFeatures = (features: Feature[]) => {
  if (features.length === 0) {
    return undefined;
  }
  const source = new VectorSource();
  source.addFeatures(features);
  return source.getExtent();
};
