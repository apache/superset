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
  ControlPanelConfig,
  ControlState,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { JsonSchema7, UISchemaElement } from '@jsonforms/core';

/**
 * Generates a JSON Schema from existing control panel configuration
 * This allows incremental migration from config-based to schema-based forms
 */

interface SchemaAndUISchema {
  schema: JsonSchema7;
  uischema: UISchemaElement;
}

/**
 * Map Superset control types to JSON Schema types
 */
const controlTypeToSchemaType = (controlType: string): any => {
  switch (controlType) {
    case 'TextControl':
    case 'TextAreaControl':
      return { type: 'string' };

    case 'SelectControl':
      return { type: 'string' };

    case 'CheckboxControl':
      return { type: 'boolean' };

    case 'SliderControl':
    case 'NumberControl':
      return { type: 'number' };

    case 'MetricsControl':
    case 'AdhocFilterControl':
      return {
        type: 'array',
        items: { type: 'object' },
      };

    default:
      return { type: 'string' };
  }
};

/**
 * Convert a single control to schema property
 */
const controlToSchemaProperty = (
  controlName: string,
  control: ControlState | CustomControlItem['config'],
): any => {
  const baseSchema = controlTypeToSchemaType(control.type as string);

  const schema = {
    ...baseSchema,
    title: control.label,
    description: control.description,
  };

  // Add enum values for SelectControl
  if (control.type === 'SelectControl' && control.choices) {
    schema.enum = control.choices.map((choice: any) =>
      Array.isArray(choice) ? choice[0] : choice.value,
    );
    schema.enumNames = control.choices.map((choice: any) =>
      Array.isArray(choice) ? choice[1] : choice.label,
    );
  }

  // Add validation
  if (control.validators) {
    // Convert validators to JSON Schema format
    if (control.required) {
      // This will be added to required array
    }
    if (control.min !== undefined) {
      schema.minimum = control.min;
    }
    if (control.max !== undefined) {
      schema.maximum = control.max;
    }
  }

  // Add default value
  if (control.default !== undefined) {
    schema.default = control.default;
  }

  return schema;
};

/**
 * Generate JSON Schema from control panel sections
 */
export function generateSchemaFromControlPanel(
  config: ControlPanelConfig,
  controls: Record<string, ControlState> = {},
): SchemaAndUISchema {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  const uiElements: UISchemaElement[] = [];

  // Process each section
  config.controlPanelSections?.forEach(section => {
    if (!section) return;
    const sectionElements: UISchemaElement[] = [];

    section.controlSetRows?.forEach(row => {
      row.forEach(item => {
        if (!item) return;

        let controlName: string;
        let controlConfig: any;

        if (typeof item === 'string') {
          // Reference to shared control
          controlName = item;
          controlConfig = controls[item] || {};
        } else if (typeof item === 'object' && 'name' in item && item.name) {
          // Custom control item
          controlName = item.name;
          controlConfig = (item as CustomControlItem).config;
        } else {
          // React element or other - skip for now
          return;
        }

        // Add to schema
        properties[controlName] = controlToSchemaProperty(
          controlName,
          controlConfig,
        );

        if (controlConfig.required) {
          required.push(controlName);
        }

        // Add to UI schema
        sectionElements.push({
          type: 'Control',
          scope: `#/properties/${controlName}`,
          label: controlConfig.label,
        });
      });
    });

    // Create a group for this section
    if (sectionElements.length > 0 && section) {
      uiElements.push({
        type: 'Group',
        label: section.label as string,
        elements: sectionElements,
      });
    }
  });

  const schema: JsonSchema7 = {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };

  const uischema: UISchemaElement = {
    type: 'VerticalLayout',
    elements: uiElements,
  };

  return { schema, uischema };
}

/**
 * Generate schema for a specific control
 */
export function generateSchemaForControl(
  controlName: string,
  control: ControlState,
): JsonSchema7 {
  return {
    type: 'object',
    properties: {
      [controlName]: controlToSchemaProperty(controlName, control),
    },
  };
}

/**
 * Merge multiple schemas (for incremental migration)
 */
export function mergeSchemas(
  base: JsonSchema7,
  ...additions: JsonSchema7[]
): JsonSchema7 {
  const merged = { ...base };

  additions.forEach(schema => {
    if (schema.properties) {
      merged.properties = {
        ...merged.properties,
        ...schema.properties,
      };
    }

    if (schema.required) {
      merged.required = [...(merged.required || []), ...schema.required];
    }
  });

  return merged;
}
