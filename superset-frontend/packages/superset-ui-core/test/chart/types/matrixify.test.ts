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
} from '../../../src/chart/types/matrixify';
import { AdhocMetric } from '../../../src/query/types/Metric';

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

test('isMatrixifyEnabled should return false when matrixify_enabled is false', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enabled: false,
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(false);
});

test('isMatrixifyEnabled should return true for valid metrics mode configuration', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: true,
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
    matrixify_enabled: false,
  } as MatrixifyFormData;

  expect(getMatrixifyValidationErrors(formData)).toEqual([]);
});

test('getMatrixifyValidationErrors should return empty array when properly configured', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enabled: true,
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
    matrixify_enabled: true,
  } as MatrixifyFormData;

  const errors = getMatrixifyValidationErrors(formData);
  expect(errors).toContain('Please configure at least one row or column axis');
});

test('getMatrixifyValidationErrors should return error when metrics mode has no metrics', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enabled: true,
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

test('should handle partial configuration with one axis only', () => {
  const formData = {
    viz_type: 'table',
    matrixify_enabled: true,
    matrixify_mode_rows: 'metrics',
    matrixify_rows: [createMetric('Revenue')],
    // No columns configuration
  } as MatrixifyFormData;

  expect(isMatrixifyEnabled(formData)).toBe(true);
});
