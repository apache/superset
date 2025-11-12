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
import { getSortTypeByDataType, getHeaderColumns } from '.';
import { DataColumnMeta } from '../../../types';

const comparisonLabels = ['Main', '#', '△', '%'];

test('getSortTypeByDataType returns datetime for temporal data', () => {
  expect(getSortTypeByDataType(GenericDataType.Temporal)).toBe('datetime');
});

test('getSortTypeByDataType returns alphanumeric for string data', () => {
  expect(getSortTypeByDataType(GenericDataType.String)).toBe('alphanumeric');
});

test('getSortTypeByDataType returns basic for numeric data', () => {
  expect(getSortTypeByDataType(GenericDataType.Numeric)).toBe('basic');
});

test('getSortTypeByDataType returns basic for boolean data', () => {
  expect(getSortTypeByDataType(GenericDataType.Boolean)).toBe('basic');
});

test('getHeaderColumns returns empty object when enableTimeComparison is false', () => {
  const columnsMeta: DataColumnMeta[] = [
    { key: 'col1', label: 'Column 1', dataType: GenericDataType.String },
  ];
  const result = getHeaderColumns(columnsMeta, comparisonLabels, false);
  expect(result).toEqual({});
});

test('getHeaderColumns returns empty object when enableTimeComparison is undefined', () => {
  const columnsMeta: DataColumnMeta[] = [
    { key: 'col1', label: 'Column 1', dataType: GenericDataType.String },
  ];
  const result = getHeaderColumns(columnsMeta, comparisonLabels);
  expect(result).toEqual({});
});

test('getHeaderColumns groups columns by key portion when time comparison is enabled', () => {
  const columnsMeta: DataColumnMeta[] = [
    { key: 'Main sales', label: 'Main', dataType: GenericDataType.Numeric },
    { key: '# sales', label: '#', dataType: GenericDataType.Numeric },
    { key: '△ sales', label: '△', dataType: GenericDataType.Numeric },
    { key: '% sales', label: '%', dataType: GenericDataType.Numeric },
  ];
  const result = getHeaderColumns(columnsMeta, comparisonLabels, true);
  expect(result).toEqual({
    ' sales': [0, 1, 2, 3],
  });
});

test('getHeaderColumns handles multiple column groups', () => {
  const columnsMeta: DataColumnMeta[] = [
    { key: 'Main sales', label: 'Main', dataType: GenericDataType.Numeric },
    { key: '# sales', label: '#', dataType: GenericDataType.Numeric },
    {
      key: 'Main revenue',
      label: 'Main',
      dataType: GenericDataType.Numeric,
    },
    { key: '# revenue', label: '#', dataType: GenericDataType.Numeric },
  ];
  const result = getHeaderColumns(columnsMeta, comparisonLabels, true);
  expect(result).toEqual({
    ' sales': [0, 1],
    ' revenue': [2, 3],
  });
});

test('getHeaderColumns ignores columns without comparison labels', () => {
  const columnsMeta: DataColumnMeta[] = [
    { key: 'Main sales', label: 'Main', dataType: GenericDataType.Numeric },
    { key: 'other', label: 'Other', dataType: GenericDataType.String },
    { key: '# sales', label: '#', dataType: GenericDataType.Numeric },
  ];
  const result = getHeaderColumns(columnsMeta, comparisonLabels, true);
  expect(result).toEqual({
    ' sales': [0, 2],
  });
});
