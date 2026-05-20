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

import {
  areDependenciesSatisfied,
  sanitizeSchema,
  buildUiSchema,
  getDynamicDependencies,
  serializeDependencyValues,
} from './jsonFormsHelpers';

test('areDependenciesSatisfied returns true for present dependency values', () => {
  expect(
    areDependenciesSatisfied(['database', 'schema'], {
      database: 'examples',
      schema: 'public',
    }),
  ).toBe(true);
});

test('areDependenciesSatisfied treats empty object dependencies as unsatisfied', () => {
  expect(
    areDependenciesSatisfied(['auth'], {
      auth: {},
    }),
  ).toBe(false);
});

test('areDependenciesSatisfied uses schema defaults for untouched fields', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        default: 'analytics',
      },
    },
  };

  expect(areDependenciesSatisfied(['database'], {}, schema)).toBe(true);
});

test('sanitizeSchema removes empty enums and preserves other properties', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      environment: {
        type: 'string',
        enum: [],
      },
      warehouse: {
        type: 'string',
        enum: ['xsmall', 'small'],
      },
    },
  };

  const sanitized = sanitizeSchema(schema);
  const sanitizedProperties =
    (sanitized.properties as Record<string, JsonSchema>) ?? {};

  expect(sanitizedProperties.environment?.enum).toBeUndefined();
  expect(sanitizedProperties.warehouse?.enum).toEqual(['xsmall', 'small']);
});

test('buildUiSchema respects x-propertyOrder and includes placeholders/tooltips', () => {
  const schema = {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Target database',
        examples: ['examples'],
      },
      schema: {
        type: 'string',
      },
    },
    'x-propertyOrder': ['schema', 'database'],
  } as JsonSchema;

  const uiSchema = buildUiSchema(schema) as {
    type: string;
    elements: Array<Record<string, unknown>>;
  };

  expect(uiSchema.type).toBe('VerticalLayout');
  expect(uiSchema.elements[0].scope).toBe('#/properties/schema');
  expect(uiSchema.elements[1].scope).toBe('#/properties/database');
  expect(uiSchema.elements[1].options).toEqual({
    placeholderText: 'examples',
    tooltip: 'Target database',
  });
});

test('getDynamicDependencies extracts x-dynamic dependency mapping', () => {
  const schema = {
    type: 'object',
    properties: {
      schema: {
        type: 'string',
        'x-dynamic': true,
        'x-dependsOn': ['database'],
      },
      database: {
        type: 'string',
      },
      warehouse: {
        type: 'string',
        'x-dynamic': true,
      },
    },
  } as JsonSchema;

  expect(getDynamicDependencies(schema)).toEqual({ schema: ['database'] });
});

test('serializeDependencyValues is stable and sorted by key', () => {
  const dynamicDeps = {
    schema: ['database'],
    role: ['warehouse', 'database'],
  };

  const data = {
    warehouse: 'compute_wh',
    database: 'analytics',
    ignored: 'x',
  };

  expect(serializeDependencyValues(dynamicDeps, data)).toBe(
    JSON.stringify({ database: 'analytics', warehouse: 'compute_wh' }),
  );
});
