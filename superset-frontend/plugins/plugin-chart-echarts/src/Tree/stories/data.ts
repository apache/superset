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

export default [
  {
    id_column: '1',
    parent_column: null,
    name_column: 'root',
    count: 10,
  },
  {
    id_column: '2',
    parent_column: '1',
    name_column: 'software',
    count: 10,
  },
  {
    id_column: '3',
    parent_column: '1',
    name_column: 'hardware',
    count: 10,
  },
  {
    id_column: '4',
    parent_column: '2',
    name_column: 'freeware',
    count: 10,
  },
  {
    id_column: '5',
    parent_column: '2',
    name_column: 'shareware',
    count: 10,
  },
  {
    id_column: '6',
    parent_column: '2',
    name_column: 'opensource',
    count: 10,
  },
  {
    id_column: '7',
    parent_column: '3',
    name_column: 'computer',
    count: 10,
  },
  {
    id_column: '8',
    parent_column: '3',
    name_column: 'cpu',
    count: 10,
  },
  {
    id_column: '9',
    parent_column: '3',
    name_column: 'mouse',
    count: 10,
  },
  {
    id_column: '10',
    parent_column: '3',
    name_column: 'keyboard',
    count: 10,
  },
  {
    id_column: '11',
    parent_column: '8',
    name_column: 'intel',
    count: 10,
  },
  {
    id_column: '12',
    parent_column: '8',
    name_column: 'ryzen',
    count: 10,
  },
  {
    id_column: '13',
    parent_column: '9',
    name_column: 'razor',
    count: 10,
  },
  {
    id_column: '14',
    parent_column: '10',
    name_column: 'Wired',
    count: 10,
  },
  {
    id_column: '15',
    parent_column: '10',
    name_column: 'Wireless',
    count: 10,
  },
  {
    id_column: '16',
    parent_column: '10',
    name_column: 'Ergonomic',
    count: 10,
  },
  {
    id_column: '17',
    parent_column: '10',
    name_column: 'Cherry mx',
    count: 10,
  },
];
