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
import { getStaleResultsTabFallback } from '../DataTablesPane';
import { ResultTypes } from '../types';

test('keeps the active tab when it still exists', () => {
  expect(
    getStaleResultsTabFallback('results 2', ['results', 'results 2']),
  ).toBeUndefined();
});

test('keeps the first results tab as-is', () => {
  expect(getStaleResultsTabFallback('results', ['results'])).toBeUndefined();
});

test('falls back to the first results tab when the active one disappears', () => {
  // A mixed chart dropped from two query results to one, removing "results 2"
  expect(getStaleResultsTabFallback('results 2', ['results'])).toBe(
    ResultTypes.Results,
  );
});

test('never redirects the Samples tab', () => {
  expect(
    getStaleResultsTabFallback(ResultTypes.Samples, ['results']),
  ).toBeUndefined();
});
