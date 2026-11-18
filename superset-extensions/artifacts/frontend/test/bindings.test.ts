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

import {
  checkQuery,
  crossFilterValue,
  runtimeFilters,
} from '../src/data/bindings';
import type { HostManifest } from '../src/frames/api';

const manifest = {
  bindings: {
    sales: {
      source: { kind: 'dataset', dataset_id: 42 },
      parameters: { year: { type: 'number' } },
    },
  },
  events: [{ kind: 'cross_filter', binding: 'sales', dimension: 'region' }],
} as unknown as HostManifest;

test('a query names a binding the manifest declares itself', () => {
  expect(
    checkQuery(manifest, { type: 'query', binding: 'sales', params: {} }),
  ).toEqual({ ok: true, value: 'sales' });
  for (const inherited of ['constructor', 'toString', '__proto__']) {
    const checked = checkQuery(manifest, {
      type: 'query',
      binding: inherited,
      params: {},
    });
    expect(checked.ok).toBe(false);
  }
});

test("a query's parameters are the binding's own", () => {
  const checked = checkQuery(manifest, {
    type: 'query',
    binding: 'sales',
    params: { toString: 1 },
  });
  expect(checked).toEqual({
    ok: false,
    reason: 'undeclared parameters: toString',
  });
});

test('a cross-filter needs a declared event on a dataset binding', () => {
  const value = { binding: 'sales', dimension: 'region', values: ['EMEA'] };
  expect(crossFilterValue(manifest, value)).toEqual({
    ok: true,
    value: { datasetId: 42, column: 'region', values: ['EMEA'] },
  });
  expect(
    crossFilterValue(manifest, { ...value, dimension: 'country' }).ok,
  ).toBe(false);
  expect(
    crossFilterValue(manifest, { ...value, binding: 'constructor' }).ok,
  ).toBe(false);
  expect(crossFilterValue(manifest, { ...value, values: [null] }).ok).toBe(
    false,
  );
});

test('cleared filters reach no binding', () => {
  expect(
    runtimeFilters([
      { filterNodeId: 'f1', value: null },
      { filterNodeId: 'f2', value: { datasetId: 1, column: 'c', values: [] } },
      {
        filterNodeId: 'f3',
        value: { datasetId: 1, column: 'c', values: ['x'] },
      },
    ] as never[]),
  ).toEqual([{ datasetId: 1, column: 'c', values: ['x'] }]);
});
