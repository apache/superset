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
      '#29696B',
      '#5BCACE',
      '#F4B02A',
      '#F1826A',
      '#792EB2',
      '#C96EC6',
      '#921E50',
      '#B27700',
      '#9C3498',
      '#9C3498',
      '#E4679D',
      '#C32F0E',
      '#9D63CA',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
