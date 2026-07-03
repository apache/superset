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
import { ChartProps, getColumnLabel } from '@superset-ui/core';
import { getRecordsFromQuery } from '../transformUtils';
import { DataRecord } from '../spatialUtils';
import { createBaseTransformResult } from '../transformUtils';

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const geojsonCol = formData.geojson
    ? getColumnLabel(formData.geojson)
    : undefined;

  if (!geojsonCol) {
    return createBaseTransformResult(chartProps, []);
  }

  const records = getRecordsFromQuery(chartProps.queriesData);
  const crossFilterCol = formData.cross_filter_column || undefined;

  // Parse each record's geojson column value (replicates backend DeckGeoJson.get_properties)
  const features = records
    .map((record: DataRecord) => {
      const geojsonStr = record[geojsonCol];
      if (geojsonStr == null) return null;
      try {
        const feature = JSON.parse(String(geojsonStr));
        // Surface cross_filter_column from the row onto feature.properties so
        // that picking can emit a dimension filter even when the GeoJSON blob
        // doesn't carry the column itself.
        if (crossFilterCol && record[crossFilterCol] !== undefined) {
          feature.properties = {
            ...feature.properties,
            [crossFilterCol]: record[crossFilterCol],
          };
        }
        return feature;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return createBaseTransformResult(chartProps, features);
}
