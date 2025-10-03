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
import { GenericDataType } from '@apache-superset/core/api/core';
import { getColumnAlignment } from './index';
import { DataColumnMeta } from '../../../types';

test('returns custom horizontal alignment when configured', () => {
  const column: DataColumnMeta = {
    key: 'test',
    label: 'Test',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    config: {
      horizontalAlign: 'center',
    },
  };

  const result = getColumnAlignment(column, false);

  expect(result.textAlign).toBe('center');
});

test('returns right alignment for numeric columns without time comparison', () => {
  const column: DataColumnMeta = {
    key: 'test',
    label: 'Test',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    config: {},
  };

  const result = getColumnAlignment(column, false);

  expect(result.textAlign).toBe('right');
});

test('returns left alignment for numeric columns with time comparison', () => {
  const column: DataColumnMeta = {
    key: 'test',
    label: 'Test',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    config: {},
  };

  const result = getColumnAlignment(column, true);

  expect(result.textAlign).toBe('left');
});

test('returns left alignment for non-numeric columns', () => {
  const column: DataColumnMeta = {
    key: 'test',
    label: 'Test',
    dataType: GenericDataType.String,
    isNumeric: false,
    isMetric: false,
    config: {},
  };

  const result = getColumnAlignment(column, false);

  expect(result.textAlign).toBe('left');
});

test('custom alignment overrides numeric defaults', () => {
  const column: DataColumnMeta = {
    key: 'test',
    label: 'Test',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    config: {
      horizontalAlign: 'left',
    },
  };

  const result = getColumnAlignment(column, false);

  expect(result.textAlign).toBe('left');
});
