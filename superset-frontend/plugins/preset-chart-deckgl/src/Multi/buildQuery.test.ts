/**
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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from './buildQuery';

const formData: QueryFormData = {
  datasource: '1__table',
  viz_type: 'deck_multi',
  deck_slices: [1, 2],
};

test('deck.gl Multiple Layers issues no query of its own', () => {
  // Each layer is a saved chart fetched client-side, so the composed chart must
  // emit an empty queries array. That empty response is why metadata sets
  // enableNoResults: false, else "No results were returned" hides the map.
  expect(buildQuery(formData).queries).toEqual([]);
});

test('deck.gl Multiple Layers emits no query even with no layers selected', () => {
  expect(buildQuery({ ...formData, deck_slices: [] }).queries).toEqual([]);
});
