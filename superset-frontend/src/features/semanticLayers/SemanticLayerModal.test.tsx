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
import { SupersetClient } from '@superset-ui/core';
import { act, render, waitFor } from 'spec/helpers/testing-library';

import SemanticLayerModal from './SemanticLayerModal';

let mockJsonFormsChangeTriggered = false;
let capturedOnChange:
  | ((value: { data: Record<string, unknown>; errors?: unknown[] }) => void)
  | null = null;

jest.mock('@jsonforms/react', () => ({
  ...jest.requireActual('@jsonforms/react'),
  JsonForms: ({ onChange }: { onChange: (value: unknown) => void }) => {
    capturedOnChange = onChange as typeof capturedOnChange;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (!mockJsonFormsChangeTriggered) {
      mockJsonFormsChangeTriggered = true;
      onChange({
        data: { warehouse: 'wh1' },
        errors: [],
      });
    }
    return null;
  },
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  getClientErrorObject: jest.fn(() => Promise.resolve({ error: '' })),
}));

const mockedGet = SupersetClient.get as jest.Mock;
const mockedPost = SupersetClient.post as jest.Mock;

const props = {
  show: true,
  onHide: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  semanticLayerUuid: '11111111-1111-1111-1111-111111111111',
};

beforeEach(() => {
  mockJsonFormsChangeTriggered = false;
  capturedOnChange = null;
  jest.useFakeTimers({ advanceTimers: true });
  mockedGet.mockReset();
  mockedPost.mockReset();

  mockedGet
    .mockResolvedValueOnce({
      json: {
        result: [{ id: 'snowflake', name: 'Snowflake', description: '' }],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          name: 'Layer 1',
          type: 'snowflake',
          configuration: { warehouse: 'wh0' },
        },
      },
    });

  mockedPost.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          warehouse: {
            type: 'string',
            'x-dynamic': true,
            'x-dependsOn': ['warehouse'],
          },
        },
      },
    },
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('posts configuration schema refresh after debounce', async () => {
  render(<SemanticLayerModal {...props} />);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenNthCalledWith(1, {
      endpoint: '/api/v1/semantic_layer/schema/configuration',
      jsonPayload: {
        type: 'snowflake',
        configuration: { warehouse: 'wh0' },
      },
    });
  });

  jest.advanceTimersByTime(501);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenNthCalledWith(2, {
      endpoint: '/api/v1/semantic_layer/schema/configuration',
      jsonPayload: {
        type: 'snowflake',
        configuration: { warehouse: 'wh1' },
      },
    });
  });
});

// Schema with an external dependency: `schema_name` depends on `database`.
const schemaWithExternalDeps = {
  type: 'object',
  properties: {
    database: {
      type: 'string',
      'x-dynamic': true,
      'x-dependsOn': ['database'],
    },
    schema_name: {
      type: 'string',
      'x-dynamic': true,
      'x-dependsOn': ['database'],
    },
  },
};

test('clears dependent field value when parent dependency changes', async () => {
  mockedGet.mockReset();
  mockedGet
    .mockResolvedValueOnce({
      json: {
        result: [{ id: 'snowflake', name: 'Snowflake', description: '' }],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          name: 'Layer 1',
          type: 'snowflake',
          configuration: { database: 'db1' },
        },
      },
    });
  mockedPost.mockResolvedValue({ json: { result: schemaWithExternalDeps } });

  render(<SemanticLayerModal {...props} />);

  // Wait for the initial schema fetch from fetchExistingLayer.
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));

  // Populate schema_name while keeping the same database — no clearing should occur.
  await act(async () => {
    capturedOnChange!({
      data: { database: 'db1', schema_name: 'public' },
      errors: [],
    });
  });

  // Change the database — schema_name must be cleared to avoid stale selections.
  await act(async () => {
    capturedOnChange!({
      data: { database: 'db2', schema_name: 'public' },
      errors: [],
    });
  });

  jest.advanceTimersByTime(501);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledTimes(2);
    const config = (
      mockedPost.mock.calls[1][0] as {
        jsonPayload: { configuration: Record<string, unknown> };
      }
    ).jsonPayload.configuration;
    expect(config.database).toBe('db2');
    // schema_name must not carry over the stale 'public' value.
    expect(config.schema_name).not.toBe('public');
  });
});

test('cancels pending schema refresh when dependencies become unsatisfied', async () => {
  render(<SemanticLayerModal {...props} />);

  // Wait for the initial fetchExistingLayer POST.
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));

  // The auto-fire from the mock set a debounce timer (warehouse='wh1' satisfies deps).
  // Clear the dependency before the timer fires — the timer must be cancelled.
  await act(async () => {
    capturedOnChange!({ data: { warehouse: '' }, errors: [] });
  });

  jest.advanceTimersByTime(501);

  await act(async () => {});

  // No additional POST should have fired; the cancelled timer must not land.
  expect(mockedPost).toHaveBeenCalledTimes(1);
});
