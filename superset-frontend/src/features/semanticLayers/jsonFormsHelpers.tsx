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
import { useEffect } from 'react';
import { t } from '@apache-superset/core';
import { Spin } from 'antd';
import { withJsonFormsControlProps } from '@jsonforms/react';
import type {
  JsonSchema,
  UISchemaElement,
  ControlProps,
} from '@jsonforms/core';
import {
  rankWith,
  and,
  isStringControl,
  formatIs,
  schemaMatches,
} from '@jsonforms/core';
import {
  rendererRegistryEntries,
  TextControl,
} from '@great-expectations/jsonforms-antd-renderers';

export const SCHEMA_REFRESH_DEBOUNCE_MS = 500;

/**
 * Custom renderer that renders `Input.Password` for fields with
 * `format: "password"` in the JSON Schema (e.g. Pydantic `SecretStr`).
 */
function PasswordControl(props: ControlProps) {
  const uischema = {
    ...props.uischema,
    options: { ...props.uischema.options, type: 'password' },
  };
  return TextControl({ ...props, uischema });
}
const PasswordRenderer = withJsonFormsControlProps(PasswordControl);
const passwordEntry = {
  tester: rankWith(3, and(isStringControl, formatIs('password'))),
  renderer: PasswordRenderer,
};

/**
 * Renderer for `const` properties (e.g. Pydantic discriminator fields).
 * Renders nothing visually but ensures the const value is set in form data,
 * so discriminated unions resolve correctly on the backend.
 */
function ConstControl({ data, handleChange, path, schema }: ControlProps) {
  const constValue = (schema as Record<string, unknown>).const;
  useEffect(() => {
    if (constValue !== undefined && data !== constValue) {
      handleChange(path, constValue);
    }
  }, [constValue, data, handleChange, path]);
  return null;
}
const ConstRenderer = withJsonFormsControlProps(ConstControl);
const constEntry = {
  tester: rankWith(10, schemaMatches(s => s !== undefined && 'const' in s)),
  renderer: ConstRenderer,
};

/**
 * Renderer for fields marked `x-dynamic` in the JSON Schema.
 * Shows a loading spinner inside the input while the schema is being
 * refreshed with dynamic values from the backend.
 */
function DynamicFieldControl(props: ControlProps) {
  const { refreshingSchema, formData: cfgData } = props.config ?? {};
  const deps = (props.schema as Record<string, unknown>)?.['x-dependsOn'];
  const refreshing =
    refreshingSchema &&
    Array.isArray(deps) &&
    areDependenciesSatisfied(deps as string[], (cfgData as Record<string, unknown>) ?? {});

  if (!refreshing) {
    return TextControl(props);
  }

  const uischema = {
    ...props.uischema,
    options: {
      ...props.uischema.options,
      placeholderText: t('Loading...'),
      inputProps: { suffix: <Spin size="small" /> },
    },
  };
  return TextControl({ ...props, uischema, enabled: false });
}
const DynamicFieldRenderer = withJsonFormsControlProps(DynamicFieldControl);
const dynamicFieldEntry = {
  tester: rankWith(
    3,
    and(
      isStringControl,
      schemaMatches(
        s => (s as Record<string, unknown>)?.['x-dynamic'] === true,
      ),
    ),
  ),
  renderer: DynamicFieldRenderer,
};

export const renderers = [
  ...rendererRegistryEntries,
  passwordEntry,
  constEntry,
  dynamicFieldEntry,
];

/**
 * Removes empty `enum` arrays from schema properties. The JSON Schema spec
 * requires `enum` to have at least one item, and AJV rejects empty arrays.
 * Fields with empty enums are rendered as plain text inputs instead.
 */
export function sanitizeSchema(schema: JsonSchema): JsonSchema {
  if (!schema.properties) return schema;
  const properties: Record<string, JsonSchema> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (
      typeof prop === 'object' &&
      prop !== null &&
      'enum' in prop &&
      Array.isArray(prop.enum) &&
      prop.enum.length === 0
    ) {
      const { enum: _empty, ...rest } = prop;
      properties[key] = rest;
    } else {
      properties[key] = prop as JsonSchema;
    }
  }
  return { ...schema, properties };
}

/**
 * Builds a JSON Forms UI schema from a JSON Schema, using the first
 * `examples` entry as placeholder text for each string property.
 */
export function buildUiSchema(
  schema: JsonSchema,
): UISchemaElement | undefined {
  if (!schema.properties) return undefined;

  // Use explicit property order from backend if available,
  // otherwise fall back to the JSON object key order
  const propertyOrder: string[] =
    (schema as Record<string, unknown>)['x-propertyOrder'] as string[] ??
    Object.keys(schema.properties);

  const elements = propertyOrder
    .filter(key => key in (schema.properties ?? {}))
    .map(key => {
      const prop = schema.properties![key];
      const control: Record<string, unknown> = {
        type: 'Control',
        scope: `#/properties/${key}`,
      };
      if (typeof prop === 'object' && prop !== null) {
        const options: Record<string, unknown> = {};
        if (
          'examples' in prop &&
          Array.isArray(prop.examples) &&
          prop.examples.length > 0
        ) {
          options.placeholderText = String(prop.examples[0]);
        }
        if ('description' in prop && typeof prop.description === 'string') {
          options.tooltip = prop.description;
        }
        if (Object.keys(options).length > 0) {
          control.options = options;
        }
      }
      return control;
    });
  return { type: 'VerticalLayout', elements } as UISchemaElement;
}

/**
 * Extracts dynamic field dependency mappings from the schema.
 * Returns a map of field name -> list of dependency field names.
 */
export function getDynamicDependencies(
  schema: JsonSchema,
): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  if (!schema.properties) return deps;
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (
      typeof prop === 'object' &&
      prop !== null &&
      'x-dynamic' in prop &&
      'x-dependsOn' in prop &&
      Array.isArray((prop as Record<string, unknown>)['x-dependsOn'])
    ) {
      deps[key] = (prop as Record<string, unknown>)[
        'x-dependsOn'
      ] as string[];
    }
  }
  return deps;
}

/**
 * Checks whether all dependency values are filled (non-empty).
 * Handles nested objects (like auth) by checking they have at least one key.
 */
export function areDependenciesSatisfied(
  dependencies: string[],
  data: Record<string, unknown>,
): boolean {
  return dependencies.every(dep => {
    const value = data[dep];
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'object' && Object.keys(value).length === 0)
      return false;
    return true;
  });
}

/**
 * Serializes the dependency values for a set of fields into a stable string
 * for comparison, so we only re-fetch when dependency values actually change.
 */
export function serializeDependencyValues(
  dynamicDeps: Record<string, string[]>,
  data: Record<string, unknown>,
): string {
  const allDepKeys = new Set<string>();
  for (const deps of Object.values(dynamicDeps)) {
    for (const dep of deps) {
      allDepKeys.add(dep);
    }
  }
  const snapshot: Record<string, unknown> = {};
  for (const key of [...allDepKeys].sort()) {
    snapshot[key] = data[key];
  }
  return JSON.stringify(snapshot);
}
