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
      '#ff385c', // rausch
      '#92174d', // plus
      '#460479', // luxe
      '#222222', // hof
      '#dddddd', // deco
      '#c13515', // arches
      '#d0650b', // ondo
      '#ffaf0f', // beach
      '#7dv734', // lima
      '#22bc4e', // spruce
      '#00ba92', // norrr
      '#007e82', // babu
      '#2875f0', // mykonou
      '#9b3197', // omiya
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
