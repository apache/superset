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
 * @fileoverview Built-in ("core") client MCP tools — see the client MCP
 * tools SIP. One folder per product surface (dashboard, chart, sqlLab,
 * dataset, alert, report, cssTemplate, savedQuery) mirrors the SIP's naming
 * convention (`core.<surface>__<name>`), so each surface's actions stay easy
 * to find and grow independently of the others. Most are still empty stubs —
 * only `dashboard` (`core.dashboard__get_active_id`) is implemented
 * so far.
 *
 * Registered once at app startup under the "core" source id — see
 * ExtensionsStartup.tsx — matching `chat.McpToolsFactory`, the same contract
 * an extension's own `mcpTools.url` module exports, so both sources are
 * aggregated identically by `chat.getTools()`.
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
const getCoreMcpTools: chatApi.McpToolsFactory = chat => [
  ...dashboardTools,
  ...chartTools,
  ...sqlLabTools,
  ...datasetTools,
  ...alertTools,
  ...reportTools,
  ...cssTemplateTools,
  ...savedQueryTools,
];

export default getCoreMcpTools;
