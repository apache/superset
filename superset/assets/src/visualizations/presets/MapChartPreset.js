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
import { Preset } from '@superset-ui/core';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';

export default class MapChartPreset extends Preset {
  constructor() {
    super({
      name: 'Maps',
      plugins: [
        new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        new WorldMapChartPlugin().configure({ key: 'world_map' }),
      ],
    });
  }
}
