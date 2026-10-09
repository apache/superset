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
import type { JsonSchema } from '@jsonforms/core';

export const LARGE_CATALOG_SIZE = 500;

/** Enum values for a large metric catalog: metric_000 … metric_499. */
export const largeMetricEnum = Array.from(
  { length: LARGE_CATALOG_SIZE },
  (_, i) => `metric_${String(i).padStart(3, '0')}`,
);

/**
 * An `{type: 'array', items: {enum: [...]}}` field schema at the guaranteed
 * acceptance scale (spec sc-107832 SC-001), shaped like the runtime schemas
 * semantic-layer extensions return (see tests/unit_tests/semantic_layers/
 * api_test.py).
 */
export const largeMultiEnumFieldSchema = {
  type: 'array',
  items: { enum: largeMetricEnum },
} as JsonSchema;

/**
 * A runtime schema exposing a large metrics multi-select plus a dynamic
 * dimensions field that depends on it — the shape that makes each metric
 * selection eligible to trigger a schema refresh.
 */
export const largeRuntimeSchema = {
  type: 'object',
  properties: {
    metrics: largeMultiEnumFieldSchema,
    dimensions: {
      type: 'array',
      items: { enum: ['dim_a', 'dim_b', 'dim_c'] },
      'x-dynamic': true,
      'x-dependsOn': ['metrics'],
    },
  },
} as JsonSchema;

/** Enum with duplicated display labels but distinct values (spec edge case). */
export const duplicateLabelEnumSchema = {
  type: 'array',
  items: {
    enum: ['metric_a_v1', 'metric_a_v2'],
    'x-enumNames': ['Revenue', 'Revenue'],
  },
} as JsonSchema;
