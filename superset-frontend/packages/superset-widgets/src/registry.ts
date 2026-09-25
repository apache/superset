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
import type { WidgetComponent } from './types';
import AgGridTableWidget from './widgets/AgGridTableWidget';
import ChartWidget from './widgets/ChartWidget';
import FilterSelectWidget from './widgets/FilterSelectWidget';
import MarkdownWidget from './widgets/MarkdownWidget';
import MetricTileWidget from './widgets/MetricTileWidget';

/** Widget types that can be rendered on their own, keyed by `widget_type`. */
export const builtInWidgetComponents: Readonly<
  Record<string, WidgetComponent>
> = {
  echarts: ChartWidget,
  'metric-tile': MetricTileWidget,
  'ag-grid-table': AgGridTableWidget,
  'filter.select': FilterSelectWidget,
  markdown: MarkdownWidget,
};

const registered = new Map<string, WidgetComponent>();

/** Adds (or overrides) the component rendered for `type`, e.g. an extension's widget. */
export function registerWidgetComponent(
  type: string,
  component: WidgetComponent,
): void {
  registered.set(type, component);
}

/** Drops a registration made by {@link registerWidgetComponent}. */
export function unregisterWidgetComponent(type: string): void {
  registered.delete(type);
}

export function getWidgetComponent(type: string): WidgetComponent | undefined {
  return registered.get(type) ?? builtInWidgetComponents[type];
}
