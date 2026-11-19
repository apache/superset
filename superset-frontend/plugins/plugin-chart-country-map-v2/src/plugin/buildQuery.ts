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
import {
  buildQueryContext,
  normalizeOrderBy,
  QueryFormData,
} from '@superset-ui/core';

/**
 * The new country map uses the modern chart/data endpoint via
 * buildQueryContext (the legacy plugin used explore_json directly).
 *
 * The data query itself is straightforward: one row per region
 * (matched against the GeoJSON's iso_3166_2 / adm0_a3 properties),
 * one metric column. The geographic data is loaded separately on the
 * client from the build pipeline's GeoJSON outputs.
 */
export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: normalizeOrderBy(baseQueryObject).orderby,
    },
  ]);
}
