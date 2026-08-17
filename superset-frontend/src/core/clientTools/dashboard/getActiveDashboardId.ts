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
 * before calling `chat.registerClientTool()`, so this file's own name is
 * just `dashboard__get_active_id`; it ends up registered as
 * `core.dashboard__get_active_id`.
 */
const getActiveDashboardId: ClientTool = {
  name: 'dashboard__get_active_id',
  description: 'Get the ID of the currently active dashboard',
  inputSchema: { type: 'object', properties: {} },
  handler: () => {
    const dashboardId = dashboard.getDashboardId();
    if (dashboardId == null) {
      return { success: false, message: 'No dashboard is currently active' };
    }
    return { success: true, dashboardId };
  },
};

export default getActiveDashboardId;
