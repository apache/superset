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
 * @fileoverview Built-in ("core") client tools — see the client tools SIP.
 * One folder per product surface (dashboard, chart, sqlLab, dataset, alert,
 * report, cssTemplate, savedQuery) mirrors the SIP's naming convention
 * (`core.<surface>__<name>`), so each surface's actions stay easy to find
 * and grow independently of the others. Most are still empty stubs — only
 * `dashboard` is implemented so far (get_active_id, change_layout,
 * update_style, get_metadata, get_filters, update_filters).
 *
 * Registered once at app startup — see ExtensionsStartup.tsx, which prefixes
 * every tool here with "core." before calling `chat.registerClientTool()` on
 * it (that prefix is ExtensionsStartup's own choice, not something this
 * factory or `registerClientTool` itself adds). Matches
 * `chat.ClientToolsFactory`, the same authoring-convenience shape an
 * extension can (optionally) use for its own tools.
 */
import type { chat as chatApi } from '@apache-superset/core';
import dashboardTools from './dashboard';
import chartTools from './chart';
import sqlLabTools from './sqlLab';
import datasetTools from './dataset';
import alertTools from './alert';
import reportTools from './report';
import cssTemplateTools from './cssTemplate';
import savedQueryTools from './savedQuery';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getCoreClientTools: chatApi.ClientToolsFactory = chat => [
  ...dashboardTools,
  ...chartTools,
  ...sqlLabTools,
  ...datasetTools,
  ...alertTools,
  ...reportTools,
  ...cssTemplateTools,
  ...savedQueryTools,
];

export default getCoreClientTools;
