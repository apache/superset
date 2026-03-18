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
  isMatrixifyEnabled,
  getMatrixifyConfig,
  getMatrixifyValidationErrors,
  MatrixifyFormData,
} from './matrixify';
import { AdhocMetric } from '../../query/types/Metric';

const createMetric = (label: string): AdhocMetric => ({
  expressionType: 'SIMPLE',
  column: { column_name: 'value' },
  aggregate: 'SUM',
  label,
});

test('isMatrixifyEnabled should return false when no matrixify configuration exists', () => {
  const formData = { viz_type: 'table' } as MatrixifyFormData;
  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return false when layout controls are disabled', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'disabled',
    matrixify_mode_columns: 'disabled',
    matrixify_rows: [createMetric('Revenue')],
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return true for valid metrics mode configuration', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_columns: [createMetric('Q1')],
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});

test('isMatrixifyEnabled should return true for valid dimensions mode configuration', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: { dimension: 'country', values: ['USA'] },
    matrixify_dimension_columns: { dimension: 'product', values: ['Widget'] },
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});

test('isMatrixifyEnabled should return true for mixed mode configuration', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'dimensions',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_dimension_columns: { dimension: 'country', values: ['USA'] },
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});

test('isMatrixifyEnabled should return true for topn dimension selection mode', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: {
      dimension: 'country',
      values: [],
      selectionMode: 'topn',
      topNMetric: 'revenue',
      topNValue: 5,
    },
    matrixify_dimension_columns: { dimension: 'product', values: ['Widget'] },
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});

test('isMatrixifyEnabled should return false when both axes have empty metrics arrays', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [],
    matrixify_columns: [],
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return false when both dimensions have empty values and no topn mode', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: { dimension: 'country', values: [] },
    matrixify_dimension_columns: { dimension: 'product', values: [] },
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('getMatrixifyConfig should return null when no matrixify configuration exists', () => {
  const formData = { viz_type: 'table' } as MatrixifyFormData;
  expect(getMatrixifyConfig(formData)).toBeNull();
});

test('getMatrixifyConfig should return valid config for metrics mode', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_columns: [createMetric('Q1')],
  } as MatrixifyFormData;

  const config = getMatrixifyConfig(formData);
  expect(config).not.toBeNull();
  expect(config!.rows.mode).toBe('metrics');
  expect(config!.columns.mode).toBe('metrics');
  expect(config!.rows.metrics).toEqual([createMetric('Revenue')]);
  expect(config!.columns.metrics).toEqual([createMetric('Q1')]);
});

test('getMatrixifyConfig should return valid config for dimensions mode', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: { dimension: 'country', values: ['USA'] },
    matrixify_dimension_columns: { dimension: 'product', values: ['Widget'] },
  } as MatrixifyFormData;

  const config = getMatrixifyConfig(formData);
  expect(config).not.toBeNull();
  expect(config!.rows.mode).toBe('dimensions');
  expect(config!.columns.mode).toBe('dimensions');
  expect(config!.rows.dimension).toEqual({
    dimension: 'country',
    values: ['USA'],
  });
  expect(config!.columns.dimension).toEqual({
    dimension: 'product',
    values: ['Widget'],
  });
});

test('getMatrixifyConfig should handle topn selection mode', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'dimensions',
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_rows: {
      dimension: 'country',
      values: [],
      selectionMode: 'topn',
      topNMetric: 'revenue',
      topNValue: 10,
    },
    matrixify_dimension_columns: { dimension: 'product', values: ['Widget'] },
  } as MatrixifyFormData;

  const config = getMatrixifyConfig(formData);
  expect(config).not.toBeNull();
  expect(config!.rows.dimension).toEqual(formData.matrixify_dimension_rows);
});

test('getMatrixifyValidationErrors should return empty array when matrixify is not enabled', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'disabled',
    matrixify_mode_columns: 'disabled',
  } as MatrixifyFormData;

  expect(getMatrixifyValidationErrors(formData)).toEqual([]);
});

test('getMatrixifyValidationErrors should return empty array when properly configured', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
    matrixify_mode_columns: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_columns: [createMetric('Q1')],
  } as MatrixifyFormData;

  expect(getMatrixifyValidationErrors(formData)).toEqual([]);
});

test('getMatrixifyValidationErrors should return error when enabled but no configuration exists', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors.length).toBeGreaterThan(0);
});

test('getMatrixifyValidationErrors should return error when metrics mode has no metrics', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [],
    matrixify_columns: [],
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors.length).toBeGreaterThan(0);
});

test('should handle undefined form data', () => {
  expect(() => isMatrixifyEnabled(undefined as any)).toThrow();
});

test('should handle null form data', () => {
  expect(() => isMatrixifyEnabled(null as any)).toThrow();
});

test('should handle empty form data object', () => {
  const formData = {} as MatrixifyFormData;
  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return false when no axis modes configured', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    // No matrixify_mode_rows or matrixify_mode_columns set
  } as MatrixifyFormData;
  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return false when switch is off even with valid axis config', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: false,
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
  } as MatrixifyFormData;
  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('getMatrixifyValidationErrors should return dimension error for rows when dimension has no data', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'dimensions',
    // No matrixify_dimension_rows set
    matrixify_mode_columns: 'metrics',
    matrixify_columns: [createMetric('Q1')],
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toContain('Please select a dimension and values for rows');
});

test('getMatrixifyValidationErrors should return metric error for columns when metrics array is empty', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_mode_columns: 'metrics',
    matrixify_columns: [],
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toContain('Please select at least one metric for columns');
});

test('getMatrixifyValidationErrors should return dimension error for columns when no dimension data', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    matrixify_mode_columns: 'dimensions',
    // No matrixify_dimension_columns set
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toContain('Please select a dimension and values for columns');
});

test('getMatrixifyValidationErrors skips row check when matrixify_mode_rows is not set', () => {
  const formData = {
    viz_type: 'table',
    // No matrixify_mode_rows — hasRowMode = false
    matrixify_mode_columns: 'metrics',
    matrixify_columns: [createMetric('Q1')],
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toEqual([]);
});

test('getMatrixifyValidationErrors evaluates full && expression when dimension is set but values are empty', () => {
  const formData = {
    viz_type: 'table',
    matrixify_mode_rows: 'dimensions',
    matrixify_dimension_rows: { dimension: 'country', values: [] },
    matrixify_mode_columns: 'dimensions',
    matrixify_dimension_columns: { dimension: 'product', values: [] },
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toContain('Please select a dimension and values for rows');
  expect(errors).toContain('Please select a dimension and values for columns');
  expect(errors).toContain(
    'Configure at least one complete row or column axis',
  );
});

test('should handle partial configuration with one axis only', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enable: true,
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    // No columns configuration
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});
