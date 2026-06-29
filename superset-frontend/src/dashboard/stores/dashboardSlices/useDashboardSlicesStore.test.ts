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

import type { Slice } from 'src/dashboard/types';
import { useDashboardSlicesStore } from './useDashboardSlicesStore';

const store = useDashboardSlicesStore;

const makeSlice = (id: number): Slice =>
  ({ slice_id: id, slice_name: `Chart ${id}` }) as Slice;

test('has an empty slices map initially', () => {
  expect(store.getState().slices).toEqual({});
});

test('setSlices replaces the whole map', () => {
  store.getState().setSlices({ 1: makeSlice(1), 2: makeSlice(2) });
  expect(Object.keys(store.getState().slices)).toEqual(['1', '2']);
  store.getState().setSlices({ 3: makeSlice(3) });
  expect(Object.keys(store.getState().slices)).toEqual(['3']);
});

test('addSlice merges a single slice without dropping the rest', () => {
  store.getState().setSlices({ 1: makeSlice(1) });
  store.getState().addSlice(makeSlice(2));
  expect(store.getState().slices[1]).toBeDefined();
  expect(store.getState().slices[2]).toMatchObject({
    slice_id: 2,
    slice_name: 'Chart 2',
  });
});
