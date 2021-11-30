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

import CategoricalScheme from '../../CategoricalScheme';

const schemes = [
  {
    id: 'bnbColors',
    label: 'Airbnb Colors',
    colors: [
      '#ff5a5f', // rausch
      '#7b0051', // hackb
      '#007A87', // kazan
      '#00d1c1', // babu
      '#8ce071', // lima
      '#ffb400', // beach
      '#b4a76c', // barol
      '#ff8083',
      '#cc0086',
      '#00a1b3',
      '#00ffeb',
      '#bbedab',
      '#ffd266',
      '#cbc29a',
      '#ff3339',
      '#ff1ab1',
      '#005c66',
      '#00b3a5',
      '#55d12e',
      '#b37e00',
      '#988b4e',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
