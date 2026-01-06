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
import { hasTemporalColumns } from './utils';

// Test hasTemporalColumns - validates time range pre-filter visibility logic
// This addresses the coverage gap from the skipped FiltersConfigModal test
// "doesn't render time range pre-filter if there are no temporal columns in datasource"

describe('hasTemporalColumns', () => {
  const createDataset = (columnTypes: GenericDataType[] | undefined) =>
    ({
      column_types: columnTypes,
    }) as Parameters<typeof hasTemporalColumns>[0];

  test('returns true when column_types is undefined (precautionary default)', () => {
    const dataset = createDataset(undefined);
    expect(hasTemporalColumns(dataset)).toBe(true);
  });

  test('returns true when column_types is empty array (precautionary default)', () => {
    const dataset = createDataset([]);
    expect(hasTemporalColumns(dataset)).toBe(true);
  });

  test('returns true when column_types includes Temporal', () => {
    const dataset = createDataset([
      GenericDataType.String,
      GenericDataType.Temporal,
      GenericDataType.Numeric,
    ]);
    expect(hasTemporalColumns(dataset)).toBe(true);
  });

  test('returns true when column_types is only Temporal', () => {
    const dataset = createDataset([GenericDataType.Temporal]);
    expect(hasTemporalColumns(dataset)).toBe(true);
  });

  test('returns false when column_types has no Temporal columns', () => {
    const dataset = createDataset([
      GenericDataType.String,
      GenericDataType.Numeric,
    ]);
    expect(hasTemporalColumns(dataset)).toBe(false);
  });

  test('returns false when column_types has only Numeric columns', () => {
    const dataset = createDataset([GenericDataType.Numeric]);
    expect(hasTemporalColumns(dataset)).toBe(false);
  });

  test('returns false when column_types has only String columns', () => {
    const dataset = createDataset([GenericDataType.String]);
    expect(hasTemporalColumns(dataset)).toBe(false);
  });

  test('returns false when column_types has Boolean but no Temporal', () => {
    const dataset = createDataset([
      GenericDataType.Boolean,
      GenericDataType.String,
    ]);
    expect(hasTemporalColumns(dataset)).toBe(false);
  });

  test('handles null dataset gracefully', () => {
    // @ts-expect-error testing null input
    expect(hasTemporalColumns(null)).toBe(true);
  });
});
