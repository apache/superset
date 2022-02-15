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
import getPointsFromPolygon from '../../src/utils/getPointsFromPolygon';

describe('getPointsFromPolygon', () => {
  it('handle original input', () => {
    expect(
      getPointsFromPolygon({
        polygon: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it('handle geojson features', () => {
    expect(
      getPointsFromPolygon({
        polygon: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 2],
                [3, 4],
              ],
            ],
          },
        },
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
