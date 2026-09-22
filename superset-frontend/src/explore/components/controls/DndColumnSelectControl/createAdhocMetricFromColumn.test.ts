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
import { GenericDataType } from '@apache-superset/core/common';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { AGGREGATES } from 'src/explore/constants';
import { createAdhocMetricFromColumn } from './DndMetricSelect';

const column = (type_generic?: GenericDataType): ColumnMeta =>
  ({ column_name: 'c', type_generic }) as ColumnMeta;

test('numeric columns default to SUM', () => {
  const metric = createAdhocMetricFromColumn(column(GenericDataType.Numeric));
  expect(metric.aggregate).toBe(AGGREGATES.SUM);
  expect(metric.column?.column_name).toBe('c');
});

test('string, boolean and temporal columns default to COUNT_DISTINCT', () => {
  [
    GenericDataType.String,
    GenericDataType.Boolean,
    GenericDataType.Temporal,
  ].forEach(type => {
    expect(createAdhocMetricFromColumn(column(type)).aggregate).toBe(
      AGGREGATES.COUNT_DISTINCT,
    );
  });
});

test('MultiValue and untyped columns get no default aggregate', () => {
  [GenericDataType.MultiValue, undefined].forEach(type => {
    expect(createAdhocMetricFromColumn(column(type)).aggregate).toBeFalsy();
  });
});
