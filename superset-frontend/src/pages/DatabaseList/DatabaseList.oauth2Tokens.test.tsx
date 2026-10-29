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
import fetchMock from 'fetch-mock';
import { FeatureFlag } from '@superset-ui/core';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatabaseList from 'src/pages/DatabaseList';

const uuid = '846ddf91-9cc3-4fb7-a218-e9d26ca5fe39';

afterEach(() => {
  window.featureFlags = {};
  fetchMock.clearHistory().removeRoutes();
});

test.each([
  [true, true, false, 'database', true],
  [false, true, false, 'database', false],
  [true, false, false, 'database', false],
  [true, true, true, 'database', true],
  [false, true, true, 'database', false],
  [true, false, true, 'database', false],
  [true, true, true, 'semantic_layer', false],
] as const)(
  'OAuth2=%s, permission=%s, semantic layers=%s, source=%s controls visibility',
  async (enabled, permitted, semanticLayers, sourceType, visible) => {
    window.featureFlags = {
      ['SEMANTIC_LAYERS' as FeatureFlag]: semanticLayers,
    };
    fetchMock.clearHistory().removeRoutes();
    fetchMock.get('glob:*/api/v1/database/_info*', {
      permissions: ['can_read', 'can_write'],
    });
    fetchMock.get('glob:*/api/v1/database/related/*', { result: [], count: 0 });
    const rowResponse = {
      count: 1,
      result: [
        {
          id: 1,
          uuid,
          source_type: sourceType,
          sl_type: 'demo',
          database_name: 'OAuth database',
          backend: 'trino',
          changed_by: null,
          engine_information: {
            supports_oauth2: true,
            oauth2_enabled: enabled,
          },
        },
      ],
    };
    fetchMock.get('glob:*/api/v1/database/?q=*', rowResponse);
    fetchMock.get('glob:*/api/v1/semantic_layer/connections/?q=*', rowResponse);
    fetchMock.get('glob:*/api/v1/database/1/oauth2_tokens/?*', {
      count: 0,
      total_count: 0,
      result: [],
    });
    const user = {
      userId: 1,
      firstName: 'Custom',
      lastName: 'User',
      roles: {
        Custom: [
          ['can_read', 'Database'],
          ['can_write', 'Database'],
          ['can_read', 'SemanticLayer'],
          ['can_write', 'SemanticLayer'],
          ...(permitted ? [['can_manage_oauth2_tokens', 'Database']] : []),
        ],
      },
      permissions: {},
      isActive: true,
      email: 'custom@example.com',
      createdOn: '2026-01-01T00:00:00',
    };
    const store = configureStore({
      reducer: {
        user: (state = user) => state,
        common: (
          state = {
            conf: {
              CSV_EXTENSIONS: ['csv'],
              EXCEL_EXTENSIONS: ['xls'],
              COLUMNAR_EXTENSIONS: ['parquet'],
              ALLOWED_EXTENSIONS: ['csv', 'xls', 'parquet'],
              SYNC_DB_PERMISSIONS_IN_ASYNC_MODE: false,
            },
          },
        ) => state,
      },
      middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
          serializableCheck: false,
          immutableCheck: false,
        }),
    });
    render(<DatabaseList user={user} />, {
      store,
      useQueryParams: true,
      useRouter: true,
    });
    await screen.findByText('OAuth database');
    if (visible) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Manage OAuth2 tokens' }),
      );
      expect(
        await screen.findByText('Manage OAuth2 tokens: OAuth database'),
      ).toBeInTheDocument();
    } else {
      expect(
        screen.queryByRole('button', { name: 'Manage OAuth2 tokens' }),
      ).not.toBeInTheDocument();
    }
  },
);
