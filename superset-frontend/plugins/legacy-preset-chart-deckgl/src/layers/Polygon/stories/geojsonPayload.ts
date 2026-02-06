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

// Placeholder GeoJSON payload data for Polygon chart stories
export default {
  data: [
    {
      contour: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.4194, 37.7749],
              [-122.4094, 37.7849],
              [-122.4294, 37.7649],
              [-122.4194, 37.7749],
            ],
          ],
        },
        properties: {},
      },
      count: 100,
    },
  ],
  colnames: ['contour', 'count'],
  coltypes: [0, 0],
};
