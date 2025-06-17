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
import { DataRecord, QueryData } from '@superset-ui/core';
import { Feature, FeatureCollection } from 'geojson';
import { Feature as OlFeature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { dataRecordsToOlFeatures } from './mapUtil';
import { GeometryFormat } from '../constants';

export const geojsonDataToFeatureCollection = (
  data: QueryData['data'],
  geomColumn: string,
) => {
  const features = data
    .map((d: DataRecord) => {
      const { [geomColumn]: geometry, ...restProps } = d;
      if (!geometry) {
        return undefined;
      }
      const feature: Feature = {
        type: 'Feature',
        geometry: JSON.parse(geometry as string),
        properties: restProps,
      };

      return feature;
    })
    .filter((f: Feature | undefined) => f !== undefined);

  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  return featureCollection;
};

export const dataToFeatureCollection = (
  data: QueryData['data'],
  geomColumn: string,
  geomFormat: GeometryFormat.WKB | GeometryFormat.WKT,
) => {
  const geojsonFormat = new GeoJSON({
    featureProjection: 'EPSG:3857',
  });
  const olFeatures = dataRecordsToOlFeatures(
    data,
    geomColumn,
    geomFormat,
  ) as OlFeature[];
  const featureCollection = geojsonFormat.writeFeaturesObject(olFeatures);

  return featureCollection;
};
