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
import { isValidElement } from 'react';
import { UISchemaElement, JsonSchema } from '@jsonforms/core';
import {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  ControlSetRow,
  ControlSetItem,
  CustomControlItem,
} from '../types';
import {
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  createTabbedLayout,
  createControl,
} from '../shared-controls/components/JsonFormsControlPanel';

/**
 * Map of control names to their control types
 */
const CONTROL_TYPE_MAP: Record<string, string> = {
  metrics: 'MetricsControl',
  metric: 'MetricControl',
  groupby: 'GroupByControl',
  columns: 'ColumnsControl',
  all_columns: 'ColumnsControl',
  adhoc_filters: 'AdhocFiltersControl',
  row_limit: 'RowLimitControl',
  limit: 'RowLimitControl',
  sort_by_metric: 'SortByMetricControl',
  time_range: 'TimeRangeControl',
  time_grain_sqla: 'TimeGrainSqlaControl',
  granularity_sqla: 'TimeGrainSqlaControl',
  color_scheme: 'ColorSchemeControl',
  linear_color_scheme: 'LinearColorSchemeControl',
  color_picker: 'ColorPickerControl',
  y_axis_format: 'YAxisFormatControl',
  currency_format: 'CurrencyFormatControl',
  datasource: 'DatasourceControl',
  viz_type: 'VizTypeControl',
  series: 'SeriesControl',
  series_columns: 'SeriesControl',
  entity: 'EntityControl',
  x_axis: 'XAxisControl',
  x: 'XAxisControl',
  y: 'YAxisControl',
  secondary_metric: 'SecondaryMetricControl',
  tooltip_columns: 'TooltipColumnsControl',
  tooltip_metrics: 'TooltipMetricsControl',
};

/**
 * Converts a legacy ControlSetItem to a UISchemaElement
 */
export function convertControlToUISchema(
  control: ControlSetItem,
): UISchemaElement | null {
  // Handle null/undefined
  if (!control) {
    return null;
  }

  // Handle React elements (custom components)
  if (isValidElement(control)) {
    // For React elements, we'll need to wrap them in a custom renderer
    return {
      type: 'Control',
      scope: '#/properties/_customComponent',
      options: {
        customComponent: control,
      },
    };
  }

  // Handle CustomControlItem
  const customControl = control as CustomControlItem;
  if (customControl.name && customControl.config) {
    const controlType = CONTROL_TYPE_MAP[customControl.name];

    return {
      type: 'Control',
      scope: `#/properties/${customControl.name}`,
      label: customControl.config.label as string,
      options: {
        controlType: controlType || 'TextControl',
        ...customControl.config,
      },
    };
  }

  return null;
}

/**
 * Converts a legacy ControlSetRow to UISchemaElements
 * Handles the array-of-arrays structure for columns
 */
export function convertRowToUISchema(row: ControlSetRow): UISchemaElement {
  const elements = row
    .map(convertControlToUISchema)
    .filter((el): el is UISchemaElement => el !== null);

  // If only one element, return it directly
  if (elements.length === 1) {
    return elements[0];
  }

  // If multiple elements, create a horizontal layout (columns)
  return createHorizontalLayout(elements);
}

/**
 * Converts a legacy ControlPanelSectionConfig to UISchemaElement
 */
export function convertSectionToUISchema(
  section: ControlPanelSectionConfig,
): UISchemaElement {
  const elements = section.controlSetRows.map(convertRowToUISchema);

  // Create a collapsible group if the section has a label
  if (section.label) {
    return createCollapsibleGroup(
      section.label as string,
      elements,
      section.expanded !== false,
    );
  }

  // Otherwise just return a vertical layout
  return createVerticalLayout(elements);
}

/**
 * Converts a legacy ControlPanelConfig to JSON Forms schema and UI schema
 */
export function migrateControlPanel(config: ControlPanelConfig): {
  schema: JsonSchema;
  uischema: UISchemaElement;
} {
  // Create the JSON schema based on controls
  const schema: JsonSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Extract all control names and build schema properties
  config.controlPanelSections.forEach(section => {
    if (!section) return;

    section.controlSetRows.forEach(row => {
      row.forEach(control => {
        if (!control || isValidElement(control)) return;

        const customControl = control as CustomControlItem;
        if (customControl.name && customControl.config) {
          // Add to schema properties
          schema.properties![customControl.name] = {
            type: 'string', // Default type, should be customized based on control type
            title: customControl.config.label as string,
            description: customControl.config.description as string,
          };

          // Add to required if needed
          if (customControl.config.validators?.length) {
            schema.required?.push(customControl.name);
          }
        }
      });
    });
  });

  // Convert sections to UI schema
  const sections = config.controlPanelSections
    .filter((section): section is ControlPanelSectionConfig => section !== null)
    .map(convertSectionToUISchema);

  // If multiple sections with labels, use tabs
  const hasMultipleNamedSections =
    config.controlPanelSections.filter(s => s && s.label).length > 1;

  let uischema: UISchemaElement;

  if (hasMultipleNamedSections) {
    // Create tabbed layout
    const categories = config.controlPanelSections
      .filter((s): s is ControlPanelSectionConfig => s !== null && !!s.label)
      .map(section => ({
        label: section.label as string,
        elements: section.controlSetRows.map(convertRowToUISchema),
      }));

    uischema = createTabbedLayout(categories);
  } else {
    // Create vertical layout with sections
    uischema = createVerticalLayout(sections);
  }

  return { schema, uischema };
}

/**
 * Creates a new JSON Forms-based control panel configuration
 */
export interface JsonFormsControlPanelConfig {
  schema: JsonSchema;
  uischema: UISchemaElement;
  controlOverrides?: Record<string, any>;
  onInit?: (state: any) => void;
  formDataOverrides?: (formData: any) => any;
}

/**
 * Helper to create a simple control panel with common patterns
 */
export function createJsonFormsControlPanel(options: {
  queryControls?: string[];
  customizationControls?: string[];
  tabs?: boolean;
}): JsonFormsControlPanelConfig {
  const {
    queryControls = [],
    customizationControls = [],
    tabs = false,
  } = options;

  // Build schema
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      ...queryControls.reduce(
        (acc, control) => ({
          ...acc,
          [control]: {
            type: 'string',
            title: control,
          },
        }),
        {},
      ),
      ...customizationControls.reduce(
        (acc, control) => ({
          ...acc,
          [control]: {
            type: 'string',
            title: control,
          },
        }),
        {},
      ),
    },
  };

  // Build UI schema
  const querySection = createCollapsibleGroup(
    'Query',
    queryControls.map(control => createControl(`#/properties/${control}`)),
    true,
  );

  const customizationSection = createCollapsibleGroup(
    'Customization',
    customizationControls.map(control =>
      createControl(`#/properties/${control}`),
    ),
    true,
  );

  const uischema = tabs
    ? createTabbedLayout([
        { label: 'Query', elements: [querySection] },
        { label: 'Customization', elements: [customizationSection] },
      ])
    : createVerticalLayout([querySection, customizationSection]);

  return { schema, uischema };
}
