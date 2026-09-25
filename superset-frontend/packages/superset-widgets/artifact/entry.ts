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

// Single-file browser build for backend-less hosts such as Claude artifacts,
// which cannot install npm packages: React and the widgets are bundled and
// handed to the page as one global.
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  Chart,
  FilterSelect,
  Markdown,
  MetricTile,
  SupersetArtifactProvider,
  SupersetProvider,
  Table,
  Widget,
  createMcpWidgetClient,
  createSession,
  getArtifactMcp,
  registerWidgetComponent,
  useSupersetFilter,
  useWidgetEvent,
  useWidgetValue,
} from '../src';

declare const __SUPERSET_WIDGETS_VERSION__: string;

const SupersetWidgets = Object.freeze({
  version: __SUPERSET_WIDGETS_VERSION__,
  createSession,
  React,
  ReactDOM,
  SupersetArtifactProvider,
  SupersetProvider,
  Widget,
  Chart,
  MetricTile,
  Table,
  FilterSelect,
  Markdown,
  useSupersetFilter,
  useWidgetEvent,
  useWidgetValue,
  createMcpWidgetClient,
  getArtifactMcp,
  registerWidgetComponent,
});

const host = globalThis as typeof globalThis & {
  SupersetWidgets?: typeof SupersetWidgets;
};

// Loading the bundle twice keeps the first copy, so widgets already mounted
// and new ones share a single React.
if (!host.SupersetWidgets) {
  host.SupersetWidgets = SupersetWidgets;
}
