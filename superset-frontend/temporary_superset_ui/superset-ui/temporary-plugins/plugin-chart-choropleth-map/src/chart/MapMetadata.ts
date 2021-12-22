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

import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import { get } from 'lodash/fp';
import { RawMapMetadata } from '../types';
import Projection from './Projection';

export default class MapMetadata {
  config: RawMapMetadata;

  keyAccessor: (...args: unknown[]) => string;

  constructor(metadata: RawMapMetadata) {
    const { keyField } = metadata;

    this.config = metadata;
    this.keyAccessor = get(keyField);
  }

  loadMap(): Promise<FeatureCollection> {
    const { key } = this.config;

    return this.config.type === 'topojson'
      ? this.config
          .load()
          .then(map => feature(map, map.objects[key]) as FeatureCollection)
      : this.config.load();
  }

  createProjection() {
    const { projection = 'Mercator', rotate } = this.config;
    const projectionFn = Projection[projection]();
    if (rotate) {
      projectionFn.rotate(rotate);
    }

    return projectionFn;
  }
}
