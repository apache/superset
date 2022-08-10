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
    id: 'supersetColors',
    label: 'Superset Colors',
    colors: [
      // Full color
      '#1FA8C9',
      '#454E7C',
      '#5AC189',
      '#FF7F44',
      '#666666',
      '#E04355',
      '#FCC700',
      '#A868B7',
      '#3CCCCB',
      '#A38F79',
      // Pastels
      '#8FD3E4',
      '#A1A6BD',
      '#ACE1C4',
      '#FEC0A1',
      '#B2B2B2',
      '#EFA1AA',
      '#FDE380',
      '#D3B3DA',
      '#9EE5E5',
      '#D1C6BC',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
