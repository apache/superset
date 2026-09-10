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

// Payload data for Polygon chart stories - San Francisco neighborhoods
export default {
  data: [
    {
      contour: [
        [-122.4194, 37.7749],
        [-122.4094, 37.7849],
        [-122.3994, 37.7749],
        [-122.4094, 37.7649],
        [-122.4194, 37.7749],
      ],
      population: 50000,
      area: 2.5,
    },
    {
      contour: [
        [-122.4394, 37.7549],
        [-122.4294, 37.7649],
        [-122.4194, 37.7549],
        [-122.4294, 37.7449],
        [-122.4394, 37.7549],
      ],
      population: 75000,
      area: 3.2,
    },
    {
      contour: [
        [-122.4494, 37.7849],
        [-122.4394, 37.7949],
        [-122.4294, 37.7849],
        [-122.4394, 37.7749],
        [-122.4494, 37.7849],
      ],
      population: 30000,
      area: 1.8,
    },
  ],
  colnames: ['contour', 'population', 'area'],
  coltypes: [0, 0, 0],
};
