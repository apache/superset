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
  JsonSchema,
  UISchemaElement,
  VerticalLayout,
  HorizontalLayout,
  GroupLayout,
  Categorization,
  ControlElement,
} from '@jsonforms/core';

/**
 * Extended JSON Forms types for Superset
 */

/**
 * Control panel configuration using JSON Forms
 */
export interface JsonFormsControlPanelConfig {
  /**
   * JSON Schema defining the data structure
   */
  schema: JsonSchema;

  /**
   * UI Schema defining the layout
   */
  uischema: UISchemaElement;

  /**
   * Optional control-specific overrides
   */
  controlOverrides?: Record<string, any>;

  /**
   * Optional initialization function
   */
  onInit?: (state: any) => void;

  /**
   * Optional form data transformation
   */
  formDataOverrides?: (formData: any) => any;
}

/**
 * Options for collapsible groups
 */
export interface CollapsibleGroupOptions {
  collapsible: boolean;
  expanded?: boolean;
}

/**
 * Extended Group type with collapsible options
 */
export interface CollapsibleGroup extends GroupLayout {
  options?: CollapsibleGroupOptions;
}

/**
 * Layout types used in control panels
 */
export type ControlPanelLayout =
  | VerticalLayout
  | HorizontalLayout
  | CollapsibleGroup
  | Categorization;

/**
 * Control element with custom renderer options
 */
export interface SupersetControlElement extends ControlElement {
  options?: {
    controlType?: string;
    customComponent?: React.ReactElement;
    [key: string]: any;
  };
}

/**
 * Helper type for creating layout builders
 */
export type LayoutBuilder<T extends UISchemaElement> = (
  elements: UISchemaElement[],
  label?: string,
  options?: any,
) => T;

/**
 * Migration result from legacy to JSON Forms
 */
export interface ControlPanelMigrationResult {
  schema: JsonSchema;
  uischema: UISchemaElement;
  warnings?: string[];
  unmigrated?: string[];
}
