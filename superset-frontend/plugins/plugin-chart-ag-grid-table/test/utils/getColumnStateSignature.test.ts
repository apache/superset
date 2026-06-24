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

const sortModel: any[] = [];
const filterModel = {};

test('signature changes when a column value aggregation changes', () => {
  const before = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }] as any,
    sortModel,
    filterModel,
  );
  const after = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'avg' }] as any,
    sortModel,
    filterModel,
  );
  expect(after).not.toEqual(before);
});

test('switching value aggregation to "None" (null/undefined) changes the signature', () => {
  // Regression test for #107166: selecting "None" must be captured so it
  // persists instead of reverting to the default Sum aggregation on reload.
  const sumState = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }] as any,
    sortModel,
    filterModel,
  );
  const noneNull = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: null }] as any,
    sortModel,
    filterModel,
  );
  const noneUndefined = getColumnStateSignature(
    [{ colId: 'sales' }] as any,
    sortModel,
    filterModel,
  );

  expect(noneNull).not.toEqual(sumState);
  expect(noneUndefined).not.toEqual(sumState);
  // null and undefined both represent "None" and must be treated identically.
  expect(noneNull).toEqual(noneUndefined);
});

test('signature is stable when nothing changes', () => {
  const a = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }] as any,
    sortModel,
    filterModel,
  );
  const b = getColumnStateSignature(
    [{ colId: 'sales', aggFunc: 'sum' }] as any,
    sortModel,
    filterModel,
  );
  expect(a).toEqual(b);
});
