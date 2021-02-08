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
import { seedRandom } from '@superset-ui/core';
import loadMap from '../../../../../../plugins/plugin-chart-choropleth-map/src/chart/loadMap';

const FRUITS = ['apple', 'banana', 'grape'];

export type FakeMapData = {
  key: string;
  favoriteFruit: string;
  numStudents: number;
}[];

/**
 * Generate mock data for the given map
 * Output is a promise of an array
 * { key, favoriteFruit, numStudents }[]
 * @param map map name
 */
export default async function generateFakeMapData(map: string) {
  const { object, metadata } = await loadMap(map);
  return object.features
    .map(f => metadata.keyAccessor(f))
    .map(key => ({
      key,
      favoriteFruit: FRUITS[Math.round(seedRandom() * 2)],
      numStudents: Math.round(seedRandom() * 100),
    }));
}
