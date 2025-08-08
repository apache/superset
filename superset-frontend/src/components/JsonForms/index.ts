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

// Main component
export { default as ModernControlPanel } from './ModernControlPanel';
export * from './ModernControlPanel';

// Schema generation
export * from './schemaGenerator';

// Migration helpers
export * from './migrationHelper';

// Renderers
export { antdRenderers } from './renderers/antd';
export { supersetRenderers } from './renderers/superset';

// Re-export JSON Forms types for convenience
export type {
  JsonSchema7,
  UISchemaElement,
  JsonFormsRendererRegistryEntry,
  ControlElement,
  Layout,
} from '@jsonforms/core';
