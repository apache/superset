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
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import type { JsonSchema } from '@jsonforms/core';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';

import SemanticLayerModal from './SemanticLayerModal';

let mockJsonFormsChangeTriggered = false;
let mockFormSchema: JsonSchema | undefined;
let mockRefreshingSchema = false;
let capturedOnChange:
  | ((value: { data: Record<string, unknown>; errors?: unknown[] }) => void)
  | null = null;

jest.mock('@jsonforms/react', () => ({
  ...jest.requireActual('@jsonforms/react'),
  JsonForms: ({
    onChange,
    readonly,
    schema,
    config,
  }: {
    onChange: (value: unknown) => void;
    readonly?: boolean;
    schema?: JsonSchema;
    config?: { refreshingSchema?: boolean };
  }) => {
    mockFormSchema = schema;
    mockRefreshingSchema = !!config?.refreshingSchema;
    capturedOnChange = onChange as typeof capturedOnChange;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (!mockJsonFormsChangeTriggered) {
      mockJsonFormsChangeTriggered = true;
      onChange({
        data: { warehouse: 'wh1' },
        errors: [],
      });
    }
    return <input aria-label="Warehouse" readOnly={readonly} />;
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
  mockFormSchema = undefined;
  mockRefreshingSchema = false;
  jest.useFakeTimers({ advanceTimers: true });
  mockedGet.mockReset();
  mockedPost.mockReset();
  jest
    .mocked(getClientErrorObject)
    .mockReset()
    .mockResolvedValue({ error: '' });

  mockedGet
    .mockResolvedValueOnce({
      json: {
        result: [{ id: 'example', name: 'Example', description: '' }],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          name: 'Layer 1',
          type: 'example',
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
        type: 'example',
        configuration: { warehouse: 'wh0' },
      },
    });
  });

  jest.advanceTimersByTime(501);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenNthCalledWith(2, {
      endpoint: '/api/v1/semantic_layer/schema/configuration',
      jsonPayload: {
        type: 'example',
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
        result: [{ id: 'example', name: 'Example', description: '' }],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          name: 'Layer 1',
          type: 'example',
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

test.each([
  ['debouncing', false],
  ['pending', false],
  ['finished', false],
  ['unsatisfied', false],
  ['debouncing', true],
  ['pending', true],
  ['finished', true],
  ['unsatisfied', true],
])(
  'ignores stale schema completion when newer dependencies are %s (failure: %s)',
  async (phase, fails) => {
    mockJsonFormsChangeTriggered = true;
    props.addDangerToast.mockClear();
    render(<SemanticLayerModal {...props} />);
    await waitFor(() => expect(capturedOnChange).not.toBeNull());
    const initialSchema = mockFormSchema;
    let finishOld: () => void = () => {};
    mockedPost.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finishOld = () =>
          fails
            ? reject(new Error('stale failure'))
            : resolve({
                json: {
                  result: {
                    type: 'object',
                    properties: { obsolete: { type: 'string' } },
                  },
                  warning: 'stale warning',
                },
              });
      }),
    );
    await act(async () => {
      capturedOnChange!({ data: { warehouse: 'wh1' }, errors: [] });
      jest.advanceTimersByTime(501);
    });
    expect(mockedPost).toHaveBeenCalledTimes(2);
    let finishNew: () => void = () => {};
    mockedPost.mockReturnValueOnce(
      new Promise(resolve => {
        finishNew = () =>
          resolve({
            json: {
              result: {
                type: 'object',
                properties: { current: { type: 'string' } },
              },
            },
          });
      }),
    );
    await act(async () => {
      capturedOnChange!({
        data: { warehouse: phase === 'unsatisfied' ? '' : 'wh2' },
        errors: [],
      });
      if (phase === 'pending' || phase === 'finished')
        jest.advanceTimersByTime(501);
    });
    if (phase === 'finished') await act(async () => finishNew());
    await act(async () => finishOld());
    expect(mockFormSchema).toEqual(
      phase === 'finished'
        ? { type: 'object', properties: { current: { type: 'string' } } }
        : initialSchema,
    );
    expect(props.addDangerToast).not.toHaveBeenCalled();
    expect(mockRefreshingSchema).toBe(
      phase === 'debouncing' || phase === 'pending',
    );
    if (phase === 'debouncing')
      await act(async () => jest.advanceTimersByTime(501));
    if (phase === 'debouncing' || phase === 'pending') {
      await act(async () => finishNew());
      expect(mockFormSchema?.properties).toEqual({
        current: { type: 'string' },
      });
      expect(mockRefreshingSchema).toBe(false);
    }
  },
);

test('Back clears pending refresh state before configuring a provider again', async () => {
  mockJsonFormsChangeTriggered = true;
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  fireEvent.mouseDown(
    await screen.findByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(await screen.findByText('Example'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(capturedOnChange).not.toBeNull());
  let finish: () => void = () => {};
  mockedPost.mockReturnValueOnce(
    new Promise(resolve => {
      finish = () =>
        resolve({ json: { result: { type: 'object', properties: {} } } });
    }),
  );
  await act(async () => {
    capturedOnChange!({ data: { warehouse: 'wh1' }, errors: [] });
    jest.advanceTimersByTime(501);
  });
  expect(mockRefreshingSchema).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Back/ }));
  capturedOnChange = null;
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(capturedOnChange).not.toBeNull());
  await act(async () => finish());
  expect(mockRefreshingSchema).toBe(false);
});

const completeCredentials = {
  endpoint: 'example-account',
  credentials: {
    method: 'key_material',
    identity: 'synthetic_user',
    key_material:
      '-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----',
  },
};
const exampleSchema = {
  type: 'object',
  properties: {
    database: {
      type: 'string',
      'x-dynamic': true,
      'x-dependsOn': ['endpoint', 'credentials'],
    },
  },
};
const safeConfigurationError =
  'Could not refresh metadata. Check the connection details and your permissions.';

async function setupExampleProvider(
  configuration: Record<string, unknown> = {},
) {
  mockJsonFormsChangeTriggered = true;
  props.addDangerToast.mockClear();
  mockedGet.mockReset();
  mockedGet
    .mockResolvedValueOnce({
      json: { result: [{ id: 'example', name: 'Example' }] },
    })
    .mockResolvedValueOnce({
      json: { result: { name: 'Example', type: 'example', configuration } },
    });
  mockedPost.mockResolvedValue({ json: { result: exampleSchema } });
  render(<SemanticLayerModal {...props} />);
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
}

test.each([
  { ...completeCredentials, endpoint: ' ' },
  {
    ...completeCredentials,
    credentials: { ...completeCredentials.credentials, identity: '' },
  },
  {
    ...completeCredentials,
    credentials: {
      ...completeCredentials.credentials,
      key_material: '-----BEGIN PRIVATE KEY-----',
    },
  },
  {
    ...completeCredentials,
    credentials: {
      ...completeCredentials.credentials,
      key_material: 'XXXXXXXXXX',
    },
  },
  {
    ...completeCredentials,
    credentials: {
      ...completeCredentials.credentials,
      key_material:
        '-----BEGIN ENCRYPTED PRIVATE KEY-----\nSYNTHETIC\n-----END ENCRYPTED PRIVATE KEY-----',
    },
  },
])('leaves incomplete credential decisions to the provider: %#', async data => {
  await setupExampleProvider();
  await act(async () => {
    capturedOnChange!({ data, errors: [] });
    jest.advanceTimersByTime(501);
  });
  expect(mockedPost).toHaveBeenCalledTimes(2);
  expect(mockedPost.mock.calls[1][0].jsonPayload.configuration).toEqual(data);
});

test('debounces edits without interpreting provider credentials', async () => {
  await setupExampleProvider();
  await act(async () => {
    capturedOnChange!({ data: completeCredentials, errors: [] });
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(mockedPost).toHaveBeenCalledTimes(1);
  await act(async () => {
    capturedOnChange!({
      data: {
        ...completeCredentials,
        credentials: {
          ...completeCredentials.credentials,
          key_material: 'partial',
        },
      },
      errors: [],
    });
  });
  await act(async () => {
    jest.advanceTimersByTime(501);
  });
  expect(mockedPost).toHaveBeenCalledTimes(2);
  expect(
    mockedPost.mock.calls[1][0].jsonPayload.configuration.credentials
      .key_material,
  ).toBe('partial');
  await act(async () => {
    capturedOnChange!({ data: completeCredentials, errors: [] });
  });
  await act(async () => {
    jest.advanceTimersByTime(501);
  });
  expect(mockedPost).toHaveBeenCalledTimes(3);
  expect(mockedPost.mock.calls[2][0].jsonPayload.configuration).toEqual(
    completeCredentials,
  );
});

test('passes masked credentials to the provider for edit schema and preserves them on Save', async () => {
  const configuration = {
    ...completeCredentials,
    credentials: {
      ...completeCredentials.credentials,
      key_material: 'XXXXXXXXXX',
    },
  };
  await setupExampleProvider(configuration);
  expect(mockedPost.mock.calls[0][0].jsonPayload.configuration).toEqual(
    configuration,
  );
  await act(async () => {
    capturedOnChange!({ data: configuration, errors: [] });
  });
  (SupersetClient.put as jest.Mock).mockResolvedValueOnce({ json: {} });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(SupersetClient.put).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPayload: { name: 'Example', configuration },
      }),
    ),
  );
});

test.each(['warning', 'rejection'])(
  'replaces refresh %s with a fixed safe message',
  async mode => {
    await setupExampleProvider();
    if (mode === 'warning')
      mockedPost.mockResolvedValueOnce({
        json: {
          result: exampleSchema,
          warning: 'SECRET <root>: value_error',
        },
      });
    else
      mockedPost.mockRejectedValueOnce(new Error('SECRET <root>: value_error'));
    await act(async () => {
      capturedOnChange!({ data: completeCredentials, errors: [] });
    });
    await act(async () => {
      jest.advanceTimersByTime(501);
    });
    await waitFor(() =>
      expect(props.addDangerToast).toHaveBeenCalledWith(safeConfigurationError),
    );
    expect(props.addDangerToast.mock.calls.flat().join()).not.toContain(
      'SECRET',
    );
  },
);

test('replaces edit-fetch failure with a safe message', async () => {
  props.addDangerToast.mockClear();
  mockedPost.mockRejectedValueOnce(new Error('SECRET <root>: value_error'));
  render(<SemanticLayerModal {...props} />);
  await waitFor(() =>
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'An error occurred while fetching the semantic layer',
    ),
  );
});

test.each([
  ['create', 'Name already exists: Example'],
  ['update', 'Name already exists: Example'],
  ['create', 'Invalid configuration: auth.private_key: missing'],
  ['update', 'Invalid configuration: auth.private_key: missing'],
  [
    'update',
    'This update changes the configuration while reusing a stored ' +
      'secret value (a masked field). Provide the real value for any ' +
      'masked field to confirm a configuration change.',
  ],
  ['create', ''],
  ['update', ''],
])('preserves the %s Save validation reason: %s', async (mode, message) => {
  props.addDangerToast.mockClear();
  props.onHide.mockClear();
  if (mode === 'update') {
    await setupExampleProvider(completeCredentials);
  } else {
    mockJsonFormsChangeTriggered = true;
    render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
    fireEvent.mouseDown(
      await screen.findByRole('combobox', { name: 'Semantic layer type' }),
    );
    fireEvent.click(await screen.findByText('Example'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(capturedOnChange).not.toBeNull());
    act(() => capturedOnChange!({ data: {}, errors: [] }));
  }
  jest
    .mocked(getClientErrorObject)
    .mockImplementationOnce(
      jest.requireActual<typeof import('@superset-ui/core')>(
        '@superset-ui/core',
      ).getClientErrorObject,
    );
  const save = mode === 'update' ? SupersetClient.put : SupersetClient.post;
  jest
    .mocked(save)
    .mockRejectedValueOnce(
      new Response(JSON.stringify({ message }), { status: 422 }),
    );
  const button = screen.getByRole('button', {
    name: mode === 'update' ? 'Save' : 'Create',
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(props.addDangerToast).toHaveBeenCalledWith(
      message ||
        (mode === 'update'
          ? 'An error occurred while updating the semantic layer'
          : 'An error occurred while creating the semantic layer'),
    ),
  );
  expect(props.onHide).not.toHaveBeenCalled();
  expect(button).toBeEnabled();
});

test('Save falls back when the normalized error has no message', async () => {
  await setupExampleProvider(completeCredentials);
  (SupersetClient.put as jest.Mock).mockRejectedValueOnce(
    new Error('SECRET <root>: value_error'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'An error occurred while updating the semantic layer',
    ),
  );
});

test('save failure without credential fields uses neutral operation wording', async () => {
  props.addDangerToast.mockClear();
  render(<SemanticLayerModal {...props} />);
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
  (SupersetClient.put as jest.Mock).mockRejectedValueOnce(new Error('SECRET'));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'An error occurred while updating the semantic layer',
    ),
  );
});

test('Reload metadata confirms and closes without navigating away from the toast', async () => {
  mockJsonFormsChangeTriggered = true;
  props.onHide.mockClear();
  render(<SemanticLayerModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Reload metadata' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(props.onHide).toHaveBeenCalledTimes(1));
  expect(mockedPost).toHaveBeenCalledWith({
    endpoint: `/api/v1/semantic_layer/${props.semanticLayerUuid}/clear_cache`,
    jsonPayload: {},
  });
  expect(props.addSuccessToast).toHaveBeenCalledWith(
    'Cache cleared; reload to fetch metadata',
  );
});

test('Reload metadata stays enabled after schema values are backfilled but disables on an edit', async () => {
  mockJsonFormsChangeTriggered = true;
  mockedPost.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          warehouse: { type: 'string' },
          region: { type: 'string', readOnly: true, default: 'us-east-1' },
          provider: { type: 'string', const: 'snowflake' },
        },
      },
    },
  });

  render(<SemanticLayerModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Reload metadata' });
  await waitFor(() => expect(capturedOnChange).not.toBeNull());

  act(() =>
    capturedOnChange?.({
      data: { warehouse: 'wh0', region: 'us-east-1', provider: 'snowflake' },
      errors: [],
    }),
  );
  expect(button).toBeEnabled();

  act(() =>
    capturedOnChange?.({
      data: { warehouse: 'wh1', region: 'us-east-1', provider: 'snowflake' },
      errors: [],
    }),
  );
  expect(button).toBeDisabled();
});

test('Reload metadata is disabled for unsaved configuration and name edits', async () => {
  render(<SemanticLayerModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Reload metadata' });
  expect(button).toBeDisabled();
  act(() => capturedOnChange?.({ data: { warehouse: 'wh0' }, errors: [] }));
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByPlaceholderText('Name of the semantic layer'), {
    target: { value: 'Unsaved name' },
  });
  expect(button).toBeDisabled();
});

test('Reload metadata reports failure without reloading or closing the editor', async () => {
  mockJsonFormsChangeTriggered = true;
  props.addDangerToast.mockClear();
  props.onHide.mockClear();
  render(<SemanticLayerModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Reload metadata' });
  await waitFor(() => expect(button).toBeEnabled());
  mockedPost.mockRejectedValueOnce(new Error('clear failed'));
  fireEvent.click(button);
  await waitFor(() =>
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Unable to clear metadata cache',
    ),
  );
  expect(props.onHide).not.toHaveBeenCalled();
  expect(button).toBeEnabled();
});

test('A pending clear prevents edits and a closed editor ignores its late response', async () => {
  mockJsonFormsChangeTriggered = true;
  props.addSuccessToast.mockClear();
  const { rerender } = render(<SemanticLayerModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Reload metadata' });
  await waitFor(() => expect(button).toBeEnabled());
  let finish: (value: { json: object }) => void = () => {};
  mockedPost.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  expect(
    screen.getByRole('textbox', { name: 'Warehouse' }),
  ).not.toHaveAttribute('readonly');
  fireEvent.click(button);
  expect(screen.getByRole('textbox', { name: 'Warehouse' })).toHaveAttribute(
    'readonly',
  );
  expect(button).toBeDisabled();
  expect(
    screen.getByPlaceholderText('Name of the semantic layer'),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  rerender(<SemanticLayerModal {...props} show={false} />);
  await act(async () => finish({ json: {} }));
  expect(props.addSuccessToast).not.toHaveBeenCalled();
});

test('starts a required semantic layer configuration action', async () => {
  mockedPost
    .mockResolvedValueOnce({
      json: {
        result: schemaWithExternalDeps,
        actions: [
          {
            id: 'oauth2',
            label: 'Connect to Quiver',
            status: 'required',
            required: true,
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          redirect_url: 'https://auth.example.test/authorize',
          tab_id: 'oauth-tab',
        },
      },
    });
  const popup = {
    close: jest.fn(),
    location: { href: '' },
  } as unknown as Window;
  const open = jest.spyOn(window, 'open').mockReturnValue(popup);

  render(<SemanticLayerModal {...props} />);

  const connect = await screen.findByRole('button', {
    name: 'Connect to Quiver',
  });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(connect);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenNthCalledWith(2, {
      endpoint: '/api/v1/semantic_layer/type/example/actions/oauth2',
      jsonPayload: {
        configuration: expect.any(Object),
        semantic_layer_uuid: props.semanticLayerUuid,
      },
    });
    expect(open).toHaveBeenCalledWith(
      '',
      'semantic-layer-action-oauth2',
      'popup,width=720,height=800',
    );
    expect(popup.location.href).toBe('https://auth.example.test/authorize');
  });

  const callsBeforeCompletion = mockedPost.mock.calls.length;
  fireEvent.focus(window);
  expect(mockedPost).toHaveBeenCalledTimes(callsBeforeCompletion);
  fireEvent(
    window,
    new StorageEvent('storage', {
      key: 'oauth2_auth_complete',
      newValue: JSON.stringify({ tabId: 'unrelated-flow' }),
    }),
  );
  expect(mockedPost).toHaveBeenCalledTimes(callsBeforeCompletion);
  fireEvent(
    window,
    new StorageEvent('storage', {
      key: 'oauth2_auth_complete',
      newValue: JSON.stringify({ tabId: 'oauth-tab' }),
    }),
  );
  await waitFor(() =>
    expect(mockedPost).toHaveBeenCalledTimes(callsBeforeCompletion + 1),
  );
  open.mockRestore();
});

test('allows another connection attempt after the popup is cancelled', async () => {
  mockedPost
    .mockResolvedValueOnce({
      json: {
        result: schemaWithExternalDeps,
        actions: [
          {
            id: 'oauth2',
            label: 'Connect',
            status: 'required',
            required: true,
          },
        ],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          redirect_url: 'https://auth.example.test/authorize',
          tab_id: 'cancelled-flow',
        },
      },
    });
  const popup = { close: jest.fn(), closed: false, location: { href: '' } };
  const open = jest
    .spyOn(window, 'open')
    .mockReturnValue(popup as unknown as Window);
  render(<SemanticLayerModal {...props} />);
  const connect = await screen.findByRole('button', { name: 'Connect' });
  fireEvent.click(connect);
  await waitFor(() => expect(popup.location.href).toContain('/authorize'));
  expect(connect).toBeDisabled();
  popup.closed = true;
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(connect).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  open.mockRestore();
});
