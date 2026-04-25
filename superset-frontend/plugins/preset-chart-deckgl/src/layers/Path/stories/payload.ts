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

// Placeholder payload data for Path chart stories
export default function payload(_theme: unknown) {
  return {
    data: [
      {
        path: [
          [-122.4194, 37.7749],
          [-122.4094, 37.7849],
          [-122.4294, 37.7649],
        ],
        metric: 100,
      },
    ],
    colnames: ['path', 'metric'],
    coltypes: [0, 0],
  };
}
