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
import { ControlStateMapping } from '@superset-ui/chart-controls';
import { GenericDataType } from '@superset-ui/core';
import { isSortable } from '../../src/utils/isSortable';

const controls: ControlStateMapping = {
  datasource: {
    datasource: {
      columns: [
        { column_name: 'a', type_generic: GenericDataType.String },
        { column_name: 'b', type_generic: GenericDataType.Numeric },
        { column_name: 'c', type_generic: GenericDataType.Boolean },
      ],
    },
    type: 'Select',
  },
};

test('should return true if the column is forced to be categorical', () => {
  const c: ControlStateMapping = {
    ...controls,
    x_axis: { value: 'b', type: 'Select' },
    xAxisForceCategorical: { value: true, type: 'Checkbox' },
  };
  expect(isSortable(c)).toBe(true);
});

test('should return true if the column is a custom SQL column', () => {
  const c: ControlStateMapping = {
    ...controls,
    x_axis: {
      value: { label: 'custom_sql', sqlExpression: 'MAX(ID)' },
      type: 'Select',
    },
  };
  expect(isSortable(c)).toBe(true);
});

test('should return true if the column type is String or Boolean', () => {
  const c: ControlStateMapping = {
    ...controls,
    x_axis: { value: 'c', type: 'Checkbox' },
  };
  expect(isSortable(c)).toBe(true);
});

test('should return false if none of the conditions are met', () => {
  const c: ControlStateMapping = {
    ...controls,
    x_axis: { value: 'b', type: 'Input' },
  };
  expect(isSortable(c)).toBe(false);
});
