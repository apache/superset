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
  isAdhocColumn,
  isPhysicalColumn,
  isQueryFormColumn,
} from '@superset-ui/core';

const adhocColumn = {
  expressionType: 'SQL',
  label: 'country',
  optionName: 'country',
  sqlExpression: 'country',
};

test('isPhysicalColumn returns true', () => {
  expect(isPhysicalColumn('gender')).toEqual(true);
});

test('isPhysicalColumn returns false', () => {
  expect(isPhysicalColumn(adhocColumn)).toEqual(false);
});

test('isAdhocColumn returns true', () => {
  expect(isAdhocColumn(adhocColumn)).toEqual(true);
});

test('isAdhocColumn returns false', () => {
  expect(isAdhocColumn('hello')).toEqual(false);
  expect(isAdhocColumn({})).toEqual(false);
  expect(
    isAdhocColumn({
      expressionType: 'SQL',
      label: 'country',
      optionName: 'country',
    }),
  ).toEqual(false);
});

test('isQueryFormColumn returns true', () => {
  expect(isQueryFormColumn('gender')).toEqual(true);
  expect(isQueryFormColumn(adhocColumn)).toEqual(true);
});

test('isQueryFormColumn returns false', () => {
  expect(isQueryFormColumn({})).toEqual(false);
});
