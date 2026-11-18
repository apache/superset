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

/**
 * The widget types whose renderers are the host's own. The registry holds
 * them for the built-in renderers, which register only once the Canvas page
 * loads, so that an extension that registers one first is refused rather
 * than the page.
 */
export const BUILTIN_WIDGET_TYPES = [
  'tabs',
  'tab',
  'group',
  'filter.bar',
  'filter.select',
  'markdown',
  'echarts',
  'metric-tile',
  'ag-grid-table',
] as const;

export type BuiltinWidgetType = (typeof BUILTIN_WIDGET_TYPES)[number];
