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
import { CompatibilityResult, ExplorePageState } from 'src/explore/types';
import {
  selectCompatibility,
  selectCompatibleDimensionNames,
  selectCompatibleMetricNames,
} from './compatibility';

const stateWith = (compatibility?: CompatibilityResult) =>
  ({ explore: { compatibility } }) as unknown as ExplorePageState;

test('verified results expose their metric and dimension names for filtering', () => {
  const state = stateWith({
    status: 'verified',
    metrics: ['m1', 'm2'],
    dimensions: ['d1'],
  });

  expect(selectCompatibleMetricNames(state)).toEqual(['m1', 'm2']);
  expect(selectCompatibleDimensionNames(state)).toEqual(['d1']);
});

test('verified empty lists filter everything instead of falling back', () => {
  const state = stateWith({ status: 'verified', metrics: [], dimensions: [] });

  expect(selectCompatibleMetricNames(state)).toEqual([]);
  expect(selectCompatibleDimensionNames(state)).toEqual([]);
});

test('idle, loading, and failed results apply no filtering', () => {
  const unfiltered: CompatibilityResult[] = [
    { status: 'idle' },
    { status: 'loading' },
    { status: 'failed' },
  ];

  unfiltered.forEach(compatibility => {
    const state = stateWith(compatibility);
    expect(selectCompatibleMetricNames(state)).toBeNull();
    expect(selectCompatibleDimensionNames(state)).toBeNull();
  });
});

test('missing compatibility state defaults to idle', () => {
  const state = stateWith(undefined);

  expect(selectCompatibility(state)).toEqual({ status: 'idle' });
  expect(selectCompatibleMetricNames(state)).toBeNull();
  expect(selectCompatibleDimensionNames(state)).toBeNull();
});
