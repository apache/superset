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
 * `core.dashboard__update_filters`. Call `core.dashboard__get_filters`
 * first to find the filter_id to change.
 */
const updateFilters: ClientTool = {
  name: 'dashboard__update_filters',
  description: 'Change the filter settings of the specified dashboard',
  inputSchema: {
    type: 'object',
    properties: {
      filter_id: {
        type: 'string',
        description: 'Id of the filter to change, from dashboard__get_filters',
      },
      value: {
        description:
          "The filter's new selected value(s) — shape depends on the " +
          'filter type (e.g. a string for a single-select filter, an ' +
          'array for a multi-select one).',
      },
    },
    required: ['filter_id', 'value'],
  },
  handler: (x: unknown) => {
    const input = x as { filter_id: string; value: unknown };
    try {
      dashboard.updateDashboardFilter(input.filter_id, input.value);
      return {
        success: true,
        message: `Updated filter "${input.filter_id}"`,
      };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  },
};

export default updateFilters;
