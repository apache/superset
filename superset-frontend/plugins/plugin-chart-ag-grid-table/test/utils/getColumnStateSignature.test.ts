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
import type { ColumnState } from '@superset-ui/core/components/ThemedAgGridReact';
import getColumnStateSignature from '../../src/utils/getColumnStateSignature';

const filterModel = {};

test('signature changes when a column value aggregation changes', () => {
  const before = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }],
    [],
    filterModel,
  );
  const after = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'avg' }],
    [],
    filterModel,
  );
  expect(after).not.toEqual(before);
});

test('switching value aggregation to "None" (null/undefined) changes the signature', () => {
  // Regression #107166: "None" must be captured so it persists on reload.
  const sumState = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }],
    [],
    filterModel,
  );
  const noneNull = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: null }],
    [],
    filterModel,
  );
  const noneUndefined = getColumnStateSignature(
    [{ colId: 'sales' }],
    [],
    filterModel,
  );

  expect(noneNull).not.toEqual(sumState);
  expect(noneUndefined).not.toEqual(sumState);
  // null and undefined both represent "None" and must be treated identically.
  expect(noneNull).toEqual(noneUndefined);
});

test('signature is stable when nothing changes', () => {
  const columnState: ColumnState[] = [{ colId: 'sales', aggFunc: 'sum' }];
  const a = getColumnStateSignature(columnState, [], filterModel);
  const b = getColumnStateSignature([...columnState], [], filterModel);
  expect(a).toEqual(b);
});

test('a function aggFunc is distinguishable from "None"', () => {
  // Pins the defensive marker: function aggFuncs stay distinct from "None".
  const customAgg = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: () => 42 }],
    [],
    filterModel,
  );
  const none = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: null }],
    [],
    filterModel,
  );
  expect(customAgg).not.toEqual(none);
});
