/*
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

import { t } from '../translation';

const VALIDE_OSM_URLS = ['https://tile.osm', 'https://tile.openstreetmap'];

/**
 * Validate a [Mapbox styles URL](https://docs.mapbox.com/help/glossary/style-url/)
 * @param v
 */
export default function validateMapboxStylesUrl(v: unknown) {
  if (typeof v === 'string') {
    const trimmed_v = v.trim();
    if (
      typeof v === 'string' &&
      trimmed_v.length > 0 &&
      (trimmed_v.startsWith('mapbox://styles/') ||
        trimmed_v.startsWith('tile://http') ||
        VALIDE_OSM_URLS.some(s => trimmed_v.startsWith(s)))
    ) {
      return false;
    }
  }

  return t(
    'is expected to be a Mapbox/OSM URL (eg. mapbox://styles/...) or a tile server URL (eg. tile://http...)',
  );
}
