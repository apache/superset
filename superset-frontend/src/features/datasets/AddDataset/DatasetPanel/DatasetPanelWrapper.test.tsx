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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { ErrorTypeEnum, SupersetClient } from '@superset-ui/core';
import type { SupersetClientResponse } from '@superset-ui/core';
import {
  DatabaseErrorMessage,
  getErrorMessageComponentRegistry,
  OAuth2RedirectMessage,
} from 'src/components/ErrorMessage';
import DatasetPanelWrapper from 'src/features/datasets/AddDataset/DatasetPanel';

jest.mock(
  '@superset-ui/core/components/Icons/AsyncIcon',
  () =>
    ({ fileName }: { fileName: string }) => (
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- mirrors AsyncIcon's real span+role="img" shape
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

const errorMessageRegistry = getErrorMessageComponentRegistry();

afterEach(() => {
  errorMessageRegistry.remove(ErrorTypeEnum.GENERIC_BACKEND_ERROR);
  errorMessageRegistry.remove(ErrorTypeEnum.OAUTH2_REDIRECT);
  jest.restoreAllMocks();
});

const tableMetadataResponse = (
  name: string,
  columnName: string,
): SupersetClientResponse => ({
  response: new Response(),
  json: {
    name,
    columns: [{ name: columnName, type: 'INTEGER', longType: 'INTEGER' }],
  },
});

test('fetches table metadata for schema-less database without schema', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(tableMetadataResponse('my_table', 'id'));

  render(
    <DatasetPanelWrapper
      tableName="my_table"
      dbId={1}
      database={{ supports_schemas: false }}
    />,
    { useRouter: true },
  );

  await waitFor(() => {
    expect(getSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining('/api/v1/database/1/table_metadata/'),
      }),
    );
  });
});

test('renders a fallback message for an unstructured metadata error', async () => {
  jest.spyOn(SupersetClient, 'get').mockRejectedValue({
    response: new Response('{}', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  errorMessageRegistry.registerValue(
    ErrorTypeEnum.GENERIC_BACKEND_ERROR,
    DatabaseErrorMessage,
  );

  render(
    <DatasetPanelWrapper
      tableName="broken_table"
      dbId={1}
      database={{ supports_schemas: false }}
    />,
    { useRouter: true },
  );

  expect(
    await screen.findByText('Unable to load columns for the selected table.'),
  ).toBeVisible();
});

test('retries only table metadata after matching OAuth completion', async () => {
  const oauthError = {
    error_type: ErrorTypeEnum.OAUTH2_REDIRECT,
    message: 'OAuth authorization is required.',
    extra: {
      url: 'https://example.com/authorize',
      tab_id: 'dataset-oauth-tab',
    },
    level: 'warning',
  };
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValueOnce({
      response: new Response(JSON.stringify({ errors: [oauthError] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    })
    .mockResolvedValueOnce(tableMetadataResponse('oauth_table', 'oauth_id'));

  errorMessageRegistry.registerValue(
    ErrorTypeEnum.OAUTH2_REDIRECT,
    OAuth2RedirectMessage,
  );

  render(
    <DatasetPanelWrapper
      tableName="oauth_table"
      dbId={1}
      database={{ supports_schemas: false }}
    />,
    {
      initialState: {
        charts: {},
        dashboardInfo: {},
        explore: {},
        sqlLab: {
          queries: {},
          queryEditors: [],
          tabHistory: [],
        },
      },
      useRedux: true,
      useRouter: true,
    },
  );

  const authorizationLink = await screen.findByRole('link', {
    name: /provide authorization/i,
  });
  expect(authorizationLink).toHaveAttribute(
    'href',
    'https://example.com/authorize',
  );
  expect(getSpy).toHaveBeenCalledTimes(1);

  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'oauth2_auth_complete',
        newValue: JSON.stringify({ tabId: 'dataset-oauth-tab' }),
      }),
    );
  });

  expect(await screen.findByText('oauth_id')).toBeVisible();
  expect(getSpy).toHaveBeenCalledTimes(2);
  expect(getSpy.mock.calls[1]).toEqual(getSpy.mock.calls[0]);
});
