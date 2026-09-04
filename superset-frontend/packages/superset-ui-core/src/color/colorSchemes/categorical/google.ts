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
    id: 'googleCategory10c',
    label: 'Google Category 10c',
    colors: [
      '#3366cc',
      '#dc3912',
      '#ff9900',
      '#109618',
      '#990099',
      '#0099c6',
      '#dd4477',
      '#66aa00',
      '#b82e2e',
      '#316395',
    ],
  },
  {
    id: 'googleCategory20c',
    label: 'Google Category 20c',
    colors: [
      '#3366cc',
      '#dc3912',
      '#ff9900',
      '#109618',
      '#990099',
      '#0099c6',
      '#dd4477',
      '#66aa00',
      '#b82e2e',
      '#316395',
      '#994499',
      '#22aa99',
      '#aaaa11',
      '#6633cc',
      '#e67300',
      '#8b0707',
      '#651067',
      '#329262',
      '#5574a6',
      '#3b3eac',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
