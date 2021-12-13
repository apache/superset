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
import { Point } from '../types';

/** Format originally used by the Polygon plugin */
type CustomPolygonFeature = {
  polygon: Point[];
};

/**
 * Format that is geojson standard
 * https://geojson.org/geojson-spec.html
 */
type GeojsonPolygonFeature = {
  polygon: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: Point[][];
    };
  };
};

export default function getPointsFromPolygon(
  feature: CustomPolygonFeature | GeojsonPolygonFeature,
) {
  return 'geometry' in feature.polygon
    ? feature.polygon.geometry.coordinates[0]
    : feature.polygon;
}
