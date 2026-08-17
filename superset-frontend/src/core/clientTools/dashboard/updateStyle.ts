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
import type { chat as chatApi } from '@apache-superset/core';
// The real implementation, not the ambient `@apache-superset/core` package
// (whose `declare function`s compile to an empty module with no runtime
// value) — this file is host code, same as ExtensionsStartup.tsx, not an
// extension going through Module Federation's shared-scope injection.
import { dashboard } from 'src/core/dashboard';

type ClientTool = chatApi.ClientTool;

/**
 * Named without the `core.` prefix — ExtensionsStartup.tsx adds that itself
 * before calling `chat.registerClientTool()`; this ends up registered as
 * `core.dashboard__update_style`.
 */
const updateStyle: ClientTool = {
  name: 'dashboard__update_style',
  description:
    'Change the theme or style settings of the current dashboard. Applies ' +
    'immediately in this browser tab; use the dashboard\'s own "Edit CSS" ' +
    'and save flow to persist the change.',
  inputSchema: {
    type: 'object',
    properties: {
      css: {
        type: 'string',
        description:
          "Replaces the dashboard's entire custom CSS with this value.",
      },
    },
    required: ['css'],
  },
  handler: (x: unknown) => {
    const input = x as { css: string };
    dashboard.updateDashboardCss(input.css);
    return { success: true, message: 'Updated dashboard style' };
  },
};

export default updateStyle;
