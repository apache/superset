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

// TODO: add the colors to the theme while working on SIP https://github.com/apache/superset/issues/20159
const schemes = [
  {
    id: 'd3Category10',
    label: 'D3 Category 10',
    colors: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#7f7f7f',
      '#bcbd22',
      '#17becf',
    ],
  },
  {
    id: 'd3Category20',
    label: 'D3 Category 20',
    colors: [
      '#1f77b4',
      '#aec7e8',
      '#ff7f0e',
      '#ffbb78',
      '#2ca02c',
      '#98df8a',
      '#d62728',
      '#ff9896',
      '#9467bd',
      '#c5b0d5',
      '#8c564b',
      '#c49c94',
      '#e377c2',
      '#f7b6d2',
      '#7f7f7f',
      '#c7c7c7',
      '#bcbd22',
      '#dbdb8d',
      '#17becf',
      '#9edae5',
    ],
  },
  {
    id: 'd3Category20b',
    label: 'D3 Category 20b',
    colors: [
      '#393b79',
      '#5254a3',
      '#6b6ecf',
      '#9c9ede',
      '#637939',
      '#8ca252',
      '#b5cf6b',
      '#cedb9c',
      '#8c6d31',
      '#bd9e39',
      '#e7ba52',
      '#e7cb94',
      '#843c39',
      '#ad494a',
      '#d6616b',
      '#e7969c',
      '#7b4173',
      '#a55194',
      '#ce6dbd',
      '#de9ed6',
    ],
  },
  {
    id: 'd3Category20c',
    label: 'D3 Category 20c',
    colors: [
      '#3182bd',
      '#6baed6',
      '#9ecae1',
      '#c6dbef',
      '#e6550d',
      '#fd8d3c',
      '#fdae6b',
      '#fdd0a2',
      '#31a354',
      '#74c476',
      '#a1d99b',
      '#c7e9c0',
      '#756bb1',
      '#9e9ac8',
      '#bcbddc',
      '#dadaeb',
      '#636363',
      '#969696',
      '#bdbdbd',
      '#d9d9d9',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
