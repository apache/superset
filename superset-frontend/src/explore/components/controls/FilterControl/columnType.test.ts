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
import { ColumnType } from './columnType';

test('ColumnType should have proper structure', () => {
  const mockColumn: ColumnType = {
    column_name: 'test_column',
    type: 'STRING',
  };

  expect(mockColumn.column_name).toBe('test_column');
  expect(mockColumn.type).toBe('STRING');
});

test('ColumnType should allow optional type field', () => {
  const mockColumn: ColumnType = {
    column_name: 'test_column',
  };

  expect(mockColumn.column_name).toBe('test_column');
  expect(mockColumn.type).toBeUndefined();
});

test('ColumnType should work with different type values', () => {
  const stringColumn: ColumnType = {
    column_name: 'str_col',
    type: 'STRING',
  };

  const numericColumn: ColumnType = {
    column_name: 'num_col',
    type: 'NUMERIC',
  };

  expect(stringColumn.type).toBe('STRING');
  expect(numericColumn.type).toBe('NUMERIC');
});
