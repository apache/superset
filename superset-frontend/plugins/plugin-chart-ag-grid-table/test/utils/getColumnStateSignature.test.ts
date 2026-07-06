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
import getColumnStateSignature from '../../src/utils/getColumnStateSignature';

const noSorts: any[] = [];
const noFilters = {};

test('changing only the value aggregation changes the signature (no sort needed)', () => {
  // Regression test for #97551: in Explore, changing a metric's Value
  // Aggregation and clicking "Update chart" must persist without first having
  // to trigger an unrelated sort change. The capture signature must therefore
  // react to aggFunc on its own.
  const before = getColumnStateSignature(
    [{ colId: 'SUM(sales)', aggFunc: 'sum' }] as any,
    noSorts,
    noFilters,
  );
  const after = getColumnStateSignature(
    [{ colId: 'SUM(sales)', aggFunc: 'avg' }] as any,
    noSorts,
    noFilters,
  );
  expect(after).not.toEqual(before);
});

test('aggregation change is detected even when order/sort/filter are identical', () => {
  const columnsA = [
    { colId: 'state', aggFunc: undefined },
    { colId: 'SUM(sales)', aggFunc: 'sum' },
  ];
  const columnsB = [
    { colId: 'state', aggFunc: undefined },
    { colId: 'SUM(sales)', aggFunc: 'max' },
  ];
  expect(
    getColumnStateSignature(columnsA as any, noSorts, noFilters),
  ).not.toEqual(getColumnStateSignature(columnsB as any, noSorts, noFilters));
});

test('identical aggregation produces a stable signature', () => {
  const cols = [{ colId: 'SUM(sales)', aggFunc: 'sum' }];
  expect(getColumnStateSignature(cols as any, noSorts, noFilters)).toEqual(
    getColumnStateSignature(cols as any, noSorts, noFilters),
  );
});
