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
  MatrixifyMode,
  MatrixifySelectionMode,
} from '../../../src/chart/types/matrixify';
import { AdhocMetric } from '../../../src/query/types/Metric';

describe('Matrixify Types and Utilities', () => {
  describe('isMatrixifyEnabled', () => {
    it('should return false when no matrixify configuration exists', () => {
      const formData = {
        viz_type: 'table',
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });

    it('should return false when matrixify_enabled is false even with valid configuration', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: false,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });

    it('should return false when matrixify_enabled is undefined even with valid configuration', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });

    it('should return true for valid metrics mode configuration', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col2' },
            aggregate: 'COUNT',
            label: 'metric2',
          } as AdhocMetric,
        ],
        matrixify_columns: [
          {
            expressionType: 'SQL',
            sqlExpression: 'SELECT SUM(col3)',
            label: 'metric3',
          } as AdhocMetric,
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col4' },
            aggregate: 'AVG',
            label: 'metric4',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true for valid dimensions mode configuration', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'dimensions',
        matrixify_dimension_rows: { dimension: 'category', values: ['A', 'B'] },
        matrixify_dimension_columns: {
          dimension: 'region',
          values: ['US', 'EU'],
        },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true for mixed mode configuration', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'dimensions',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
        matrixify_dimension_columns: { dimension: 'category', values: ['A'] },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true for topn dimension selection mode', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'metrics',
        matrixify_dimension_rows: { dimension: 'category', values: [] },
        matrixify_dimension_selection_mode_rows: 'topn',
        matrixify_columns: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true when only columns configuration exists', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'metrics',
        matrixify_columns: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true when only rows configuration exists', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return true when one axis has valid data and other is empty', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'metrics',
        matrixify_rows: [] as AdhocMetric[],
        matrixify_columns: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return false when both axes have empty metrics arrays', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'metrics',
        matrixify_mode_columns: 'metrics',
        matrixify_rows: [] as AdhocMetric[],
        matrixify_columns: [] as AdhocMetric[],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });

    it('should return true when one dimension has values and other is empty', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'dimensions',
        matrixify_dimension_rows: { dimension: 'category', values: [] },
        matrixify_dimension_columns: { dimension: 'region', values: ['US'] },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return false when both dimensions have empty values and no topn mode', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'dimensions',
        matrixify_dimension_rows: { dimension: 'category', values: [] },
        matrixify_dimension_columns: { dimension: 'region', values: [] },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });

    it('should return true when one dimension is valid and other has no name', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'dimensions',
        matrixify_dimension_rows: { dimension: '', values: ['A'] },
        matrixify_dimension_columns: { dimension: 'region', values: ['US'] },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
    });

    it('should return false when both dimensions have no names', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'dimensions',
        matrixify_mode_columns: 'dimensions',
        matrixify_dimension_rows: { dimension: '', values: ['A'] },
        matrixify_dimension_columns: { dimension: '', values: ['US'] },
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(false);
    });
  });

  describe('getMatrixifyConfig', () => {
    it('should return null when no matrixify configuration exists', () => {
      const formData = {
        viz_type: 'table',
      } as MatrixifyFormData;

      expect(getMatrixifyConfig(formData)).toBeNull();
    });

    it('should return valid config for metrics mode', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'metrics' as MatrixifyMode,
        matrixify_mode_columns: 'metrics' as MatrixifyMode,
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col2' },
            aggregate: 'COUNT',
            label: 'metric2',
          } as AdhocMetric,
        ],
        matrixify_columns: [
          {
            expressionType: 'SQL',
            sqlExpression: 'SELECT SUM(col3)',
            label: 'metric3',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      const config = getMatrixifyConfig(formData);
      expect(config).toEqual({
        rows: {
          mode: 'metrics',
          metrics: [
            {
              expressionType: 'SIMPLE',
              column: { column_name: 'col1' },
              aggregate: 'SUM',
              label: 'metric1',
            } as AdhocMetric,
            {
              expressionType: 'SIMPLE',
              column: { column_name: 'col2' },
              aggregate: 'COUNT',
              label: 'metric2',
            } as AdhocMetric,
          ],
          selectionMode: undefined,
          dimension: undefined,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
        columns: {
          mode: 'metrics',
          metrics: [
            {
              expressionType: 'SQL',
              sqlExpression: 'SELECT SUM(col3)',
              label: 'metric3',
            } as AdhocMetric,
          ],
          selectionMode: undefined,
          dimension: undefined,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
      });
    });

    it('should return valid config for dimensions mode', () => {
      const dimensionRows = { dimension: 'category', values: ['A', 'B'] };
      const dimensionCols = { dimension: 'region', values: ['US'] };

      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'dimensions' as MatrixifyMode,
        matrixify_mode_columns: 'dimensions' as MatrixifyMode,
        matrixify_dimension_rows: dimensionRows,
        matrixify_dimension_columns: dimensionCols,
      } as MatrixifyFormData;

      const config = getMatrixifyConfig(formData);
      expect(config).toEqual({
        rows: {
          mode: 'dimensions',
          metrics: undefined,
          selectionMode: undefined,
          dimension: dimensionRows,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
        columns: {
          mode: 'dimensions',
          metrics: undefined,
          selectionMode: undefined,
          dimension: dimensionCols,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
      });
    });

    it('should return valid config for mixed mode', () => {
      const dimensionCols = { dimension: 'region', values: ['US'] };

      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'metrics' as MatrixifyMode,
        matrixify_mode_columns: 'dimensions' as MatrixifyMode,
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
        matrixify_dimension_columns: dimensionCols,
      } as MatrixifyFormData;

      const config = getMatrixifyConfig(formData);
      expect(config).toEqual({
        rows: {
          mode: 'metrics',
          metrics: [
            {
              expressionType: 'SIMPLE',
              column: { column_name: 'col1' },
              aggregate: 'SUM',
              label: 'metric1',
            } as AdhocMetric,
          ],
          selectionMode: undefined,
          dimension: undefined,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
        columns: {
          mode: 'dimensions',
          metrics: undefined,
          selectionMode: undefined,
          dimension: dimensionCols,
          topnValue: undefined,
          topnMetric: undefined,
          topnOrder: undefined,
        },
      });
    });

    it('should handle topn selection mode', () => {
      const formData = {
        viz_type: 'table',
        matrixify_mode_rows: 'dimensions' as MatrixifyMode,
        matrixify_mode_columns: 'metrics' as MatrixifyMode,
        matrixify_dimension_selection_mode_rows:
          'topn' as MatrixifySelectionMode,
        matrixify_topn_value_rows: 10,
        matrixify_topn_order_rows: 'desc',
        matrixify_columns: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      const config = getMatrixifyConfig(formData);
      expect(config?.rows.selectionMode).toBe('topn');
      expect(config?.rows.topnValue).toBe(10);
      expect(config?.rows.topnOrder).toBe('desc');
    });

    it('should return null when no mode is specified', () => {
      const formData = {
        viz_type: 'table',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      const config = getMatrixifyConfig(formData);
      expect(config).toBeNull();
    });
  });

  describe('getMatrixifyValidationErrors', () => {
    it('should return empty array when matrixify is not enabled', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: false,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [],
      } as MatrixifyFormData;

      expect(getMatrixifyValidationErrors(formData)).toEqual([]);
    });

    it('should return empty array when matrixify is enabled and properly configured', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(getMatrixifyValidationErrors(formData)).toEqual([]);
    });

    it('should return error when enabled but no configuration exists', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
      } as MatrixifyFormData;

      const errors = getMatrixifyValidationErrors(formData);
      expect(errors).toContain(
        'Please configure at least one row or column axis',
      );
    });

    it('should return error when metrics mode has no metrics', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [],
      } as MatrixifyFormData;

      const errors = getMatrixifyValidationErrors(formData);
      expect(errors).toContain('Please select at least one metric for rows');
    });

    it('should return error when dimensions mode has no dimension selected', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'dimensions',
        matrixify_dimension_rows: { dimension: '', values: [] },
      } as MatrixifyFormData;

      const errors = getMatrixifyValidationErrors(formData);
      expect(errors).toContain('Please select a dimension and values for rows');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined form data by throwing error', () => {
      expect(() => isMatrixifyEnabled(undefined as any)).toThrow(TypeError);
      expect(() => getMatrixifyConfig(undefined as any)).toThrow(TypeError);
    });

    it('should handle null form data by throwing error', () => {
      expect(() => isMatrixifyEnabled(null as any)).toThrow(TypeError);
      expect(() => getMatrixifyConfig(null as any)).toThrow(TypeError);
    });

    it('should handle empty form data object', () => {
      const formData = {} as MatrixifyFormData;
      expect(isMatrixifyEnabled(formData)).toBe(false);
      expect(getMatrixifyConfig(formData)).toBeNull();
    });

    it('should handle partial configuration (one axis)', () => {
      const formData = {
        viz_type: 'table',
        matrixify_enabled: true,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [
          {
            expressionType: 'SIMPLE',
            column: { column_name: 'col1' },
            aggregate: 'SUM',
            label: 'metric1',
          } as AdhocMetric,
        ],
      } as MatrixifyFormData;

      expect(isMatrixifyEnabled(formData)).toBe(true);
      const config = getMatrixifyConfig(formData);
      expect(config?.rows.mode).toBe('metrics');
      expect(config?.columns.mode).toBe('metrics');
    });
  });
});
