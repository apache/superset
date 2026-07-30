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

/**
 * The catalog is the schema half of the component manifest — pure metadata, no
 * React. It is the allowlist of node types plus their contract (events,
 * bindable props). The renderer's manifest maps these names to components; the
 * validator and (eventually) the backend/MCP JSON-schema consume the same
 * source so the AI-facing contract never drifts from the renderer.
 */

export type NodeCategory = 'layout' | 'viz' | 'control' | 'display';

export interface CatalogEntry {
  name: string;
  category: NodeCategory;
  /** May hold `children`. */
  container: boolean;
  /** Allowed `on.*` event names. */
  events: string[];
  /** Props that accept a `$var` reference / two-way `bind`. */
  bindableProps: string[];
  /** Props that must be present. */
  requiredProps: string[];
}

export const NODE_CATALOG: Record<string, CatalogEntry> = {
  Column: {
    name: 'Column',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Row: {
    name: 'Row',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Card: {
    name: 'Card',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Tabs: {
    name: 'Tabs',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Board: {
    name: 'Board',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Tab: {
    name: 'Tab',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: ['label'],
  },
  Divider: {
    name: 'Divider',
    category: 'display',
    container: false,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Alert: {
    name: 'Alert',
    category: 'display',
    container: false,
    events: [],
    bindableProps: [],
    requiredProps: ['message'],
  },
  Progress: {
    name: 'Progress',
    category: 'display',
    container: false,
    events: [],
    bindableProps: ['value'],
    requiredProps: [],
  },
  Collapse: {
    name: 'Collapse',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Modal: {
    name: 'Modal',
    category: 'layout',
    container: true,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
  Input: {
    name: 'Input',
    category: 'control',
    container: false,
    events: ['change'],
    bindableProps: ['value'],
    requiredProps: [],
  },
  Switch: {
    name: 'Switch',
    category: 'control',
    container: false,
    events: ['change'],
    bindableProps: ['value'],
    requiredProps: [],
  },
  Select: {
    name: 'Select',
    category: 'control',
    container: false,
    events: ['change'],
    bindableProps: ['value'],
    requiredProps: ['options'],
  },
  Button: {
    name: 'Button',
    category: 'control',
    container: false,
    events: ['click'],
    bindableProps: [],
    requiredProps: [],
  },
  Filter: {
    name: 'Filter',
    category: 'control',
    container: false,
    events: [],
    bindableProps: [],
    requiredProps: ['column'],
  },
  Markdown: {
    name: 'Markdown',
    category: 'display',
    container: false,
    events: [],
    bindableProps: [],
    requiredProps: ['text'],
  },
  Viz: {
    name: 'Viz',
    category: 'viz',
    container: false,
    events: [],
    bindableProps: [],
    requiredProps: [],
  },
};

export const isKnownType = (type: string): boolean =>
  Object.prototype.hasOwnProperty.call(NODE_CATALOG, type);
