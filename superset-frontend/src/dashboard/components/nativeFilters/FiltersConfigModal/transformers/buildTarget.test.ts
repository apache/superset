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
import { DatasourceType } from '@superset-ui/core';
import { buildNativeFilterTarget } from './buildTarget';

test('returns an empty target when no dataset is selected', () => {
  expect(buildNativeFilterTarget({})).toEqual({});
});

test('uses dataset.value when dataset is an object', () => {
  expect(
    buildNativeFilterTarget({
      dataset: { value: 7 },
      column: 'colA',
    }),
  ).toEqual({ datasetId: 7, column: { name: 'colA' } });
});

test('uses dataset directly when dataset is a primitive number', () => {
  // ``filterTransformer`` accepts the legacy primitive shape, so the helper
  // has to handle both.
  expect(
    buildNativeFilterTarget({
      dataset: 42,
      column: 'colB',
    }),
  ).toEqual({ datasetId: 42, column: { name: 'colB' } });
});

test('includes datasourceType when present', () => {
  expect(
    buildNativeFilterTarget({
      dataset: { value: 1 },
      datasourceType: DatasourceType.SemanticView,
      column: 'colC',
    }),
  ).toEqual({
    datasetId: 1,
    datasourceType: DatasourceType.SemanticView,
    column: { name: 'colC' },
  });
});

test('omits column when no column is selected', () => {
  expect(
    buildNativeFilterTarget({
      dataset: { value: 9 },
    }),
  ).toEqual({ datasetId: 9 });
});

test('omits datasourceType when undefined', () => {
  const target = buildNativeFilterTarget({
    dataset: { value: 5 },
    column: 'colD',
  });
  expect(target).not.toHaveProperty('datasourceType');
});
