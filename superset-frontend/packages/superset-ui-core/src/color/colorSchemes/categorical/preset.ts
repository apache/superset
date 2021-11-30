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
    id: 'presetColors',
    label: 'Preset Colors',
    colors: [
      // Full color
      '#6BD3B3',
      '#FCC550',
      '#408184',
      '#66CBE2',
      '#EE5960',
      '#484E5A',
      '#FF874E',
      '#03748E',
      '#C9BBAB',
      '#B17BAA',
      // Pastels
      '#B5E9D9',
      '#FDE2A7',
      '#9FC0C1',
      '#B2E5F0',
      '#F6ACAF',
      '#A4A6AC',
      '#FFC3A6',
      '#81B9C6',
      '#E4DDD5',
      '#D9BDD5',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
