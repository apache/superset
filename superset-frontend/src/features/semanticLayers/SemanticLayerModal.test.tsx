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
import getBootstrapData from 'src/utils/getBootstrapData';
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

let mockSemanticDocsUrl: unknown;
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  ...jest.requireActual('src/utils/getBootstrapData'),
  default: jest.fn(jest.requireActual('src/utils/getBootstrapData').default),
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
  props.addDangerToast.mockClear();
  props.addSuccessToast.mockClear();
  props.onHide.mockClear();
  mockSemanticDocsUrl = undefined;
  jest.mocked(getBootstrapData).mockImplementation(() => {
    const bootstrap = jest
      .requireActual('src/utils/getBootstrapData')
      .default();
    return {
      ...bootstrap,
      common: {
        ...bootstrap.common,
        conf: {
          ...bootstrap.common.conf,
          SEMANTIC_LAYER_DOCUMENTATION_URL: mockSemanticDocsUrl,
        },
      },
    };
  });
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

test('a successful edit after Cancel refreshes the parent without stale modal UI', async () => {
  mockJsonFormsChangeTriggered = true;
  const onUpdated = jest.fn();
  let finishUpdate!: (value: { json: object }) => void;
  const mockedPut = SupersetClient.put as jest.Mock;
  mockedPut.mockReset().mockReturnValueOnce(
    new Promise(resolve => {
      finishUpdate = resolve;
    }),
  );
  const { rerender } = render(
    <SemanticLayerModal {...props} onUpdated={onUpdated} />,
  );
  const save = await screen.findByRole('button', { name: 'Save' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onHide).toHaveBeenCalledTimes(1);
  rerender(
    <SemanticLayerModal {...props} onUpdated={onUpdated} show={false} />,
  );
  await act(async () => finishUpdate({ json: {} }));

  expect(onUpdated).toHaveBeenCalledTimes(1);
  expect(props.onHide).toHaveBeenCalledTimes(1);
  expect(props.addSuccessToast).not.toHaveBeenCalled();
});

test('a failed create after Cancel does not show a stale danger toast', async () => {
  let failCreate!: (error: Error) => void;
  mockedPost
    .mockReset()
    .mockResolvedValueOnce({
      json: { result: { type: 'object', properties: {} } },
    })
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        failCreate = reject;
      }),
    );
  const { rerender } = render(
    <SemanticLayerModal {...props} semanticLayerUuid={undefined} />,
  );
  const typePicker = await screen.findByRole('combobox', {
    name: 'Semantic layer type',
  });
  fireEvent.mouseDown(typePicker);
  fireEvent.click(await screen.findByText('Example'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  const create = await screen.findByRole('button', { name: 'Create' });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  rerender(
    <SemanticLayerModal
      {...props}
      semanticLayerUuid={undefined}
      show={false}
    />,
  );
  await act(async () => failCreate(new Error('late create failure')));

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('a failed edit after Cancel does not show a stale danger toast', async () => {
  mockJsonFormsChangeTriggered = true;
  let failUpdate!: (error: Error) => void;
  const mockedPut = SupersetClient.put as jest.Mock;
  mockedPut.mockReset().mockReturnValueOnce(
    new Promise((_, reject) => {
      failUpdate = reject;
    }),
  );
  const { rerender } = render(<SemanticLayerModal {...props} />);
  const save = await screen.findByRole('button', { name: 'Save' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(mockedPut).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  rerender(<SemanticLayerModal {...props} show={false} />);
  await act(async () => failUpdate(new Error('late update failure')));

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('cancel during error parsing suppresses a stale save danger toast', async () => {
  mockJsonFormsChangeTriggered = true;
  let finishError!: (value: { error: string }) => void;
  jest.mocked(getClientErrorObject).mockReturnValueOnce(
    new Promise(resolve => {
      finishError = resolve;
    }),
  );
  const mockedPut = SupersetClient.put as jest.Mock;
  mockedPut.mockReset().mockRejectedValueOnce(new Error('save failed'));
  const { rerender } = render(<SemanticLayerModal {...props} />);
  const save = await screen.findByRole('button', { name: 'Save' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(getClientErrorObject).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  rerender(<SemanticLayerModal {...props} show={false} />);
  await act(async () => finishError({ error: 'save failed' }));

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('schema loading keeps an in-flow spinner in a reserved modal body', async () => {
  let finishSchema!: (value: { json: { result: JsonSchema } }) => void;
  mockedPost.mockReset().mockReturnValueOnce(
    new Promise(resolve => {
      finishSchema = resolve;
    }),
  );
  render(<SemanticLayerModal {...props} />);
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));

  const spinner = screen.getByRole('status', { name: 'Loading' });
  expect(spinner).toHaveClass('normal');
  expect(spinner.parentElement).toHaveStyle({ minHeight: '200px' });
  await act(async () =>
    finishSchema({ json: { result: { type: 'object', properties: {} } } }),
  );
});

test('setup guidance distinguishes loading and empty provider types', async () => {
  let resolveTypes!: (value: { json: { result: [] } }) => void;
  mockedGet.mockReset().mockReturnValue(
    new Promise(resolve => {
      resolveTypes = resolve;
    }),
  );
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading semantic layer types',
  );
  expect(screen.queryByText(/No semantic layer types/)).not.toBeInTheDocument();
  await act(async () => resolveTypes({ json: { result: [] } }));
  expect(
    await screen.findByText(/No semantic layer types are available/),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});

test.each([
  {},
  { result: null },
  { result: {} },
  { result: [{ name: 'missing id' }] },
])('setup guidance rejects malformed provider lists: %j', async json => {
  mockedGet.mockReset().mockResolvedValue({ json });
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load semantic layer types',
  );
  expect(screen.queryByText(/No semantic layer types/)).not.toBeInTheDocument();
});

test.each([403, 404, 500])(
  'setup guidance retries type failure %s without diagnosing installation',
  async status => {
    mockedGet
      .mockReset()
      .mockRejectedValueOnce({ status })
      .mockResolvedValueOnce({ json: { result: [] } });
    render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load semantic layer types',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(/No semantic layer types are available/),
    ).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledTimes(2);
  },
);

test('setup guidance displays provider-owned text before and during configuration', async () => {
  mockedGet.mockReset().mockResolvedValue({
    json: {
      result: [
        {
          id: 'first',
          name: 'First provider',
          description: 'Prepare credentials for the first provider.',
        },
        {
          id: 'second',
          name: 'Second provider',
          description: '<script>second provider</script>',
        },
      ],
    },
  });
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  fireEvent.mouseDown(
    await screen.findByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(await screen.findByText('First provider'));
  expect(
    screen.getByText('Prepare credentials for the first provider.'),
  ).toBeInTheDocument();
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(await screen.findByText('Second provider'));
  expect(
    screen.queryByText('Prepare credentials for the first provider.'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText('<script>second provider</script>'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(
    await screen.findByText('Configure Second provider'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('<script>second provider</script>'),
  ).toBeInTheDocument();
});

test.each([null, undefined, '', 42])(
  'setup guidance tolerates optional provider description %s',
  async description => {
    mockedGet.mockReset().mockResolvedValue({
      json: {
        result: [{ id: 'plain', name: 'Plain provider', description }],
      },
    });
    render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
    fireEvent.mouseDown(
      await screen.findByRole('combobox', { name: 'Semantic layer type' }),
    );
    fireEvent.click(await screen.findByText('Plain provider'));
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    expect(
      screen.queryByTestId('semantic-provider-description'),
    ).not.toBeInTheDocument();
  },
);

describe('setup documentation', () => {
  test.each([
    undefined,
    null,
    '',
    '   ',
    '/relative',
    'https://',
    'https:example.org',
    '//example.org/docs',
    // Deliberately unsafe input: the link must reject executable URLs.
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:secret@example.org/docs',
    123,
  ])('hides an unset or unsafe URL: %p', async url => {
    mockSemanticDocsUrl = url;
    mockedGet.mockReset().mockResolvedValue({ json: { result: [] } });
    render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
    await screen.findByText(/No semantic layer/);
    expect(
      screen.queryByRole('link', { name: 'Semantic layer setup guide' }),
    ).not.toBeInTheDocument();
  });

  test.each([
    'https://docs.example.org/setup',
    'http://docs.example.org/setup',
  ])(
    'keeps the configured help link available while loading and after failure: %s',
    async url => {
      mockSemanticDocsUrl = url;
      let reject!: (reason: Error) => void;
      mockedGet.mockReset().mockReturnValue(
        new Promise((_, rejectRequest) => {
          reject = rejectRequest;
        }),
      );
      render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
      const link = screen.getByRole('link', {
        name: 'Semantic layer setup guide',
      });
      expect(link).toHaveAttribute('href', url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await act(async () => reject(new Error('private detail')));
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
      expect(
        screen.getByRole('link', { name: 'Semantic layer setup guide' }),
      ).toHaveAttribute('href', url);
      expect(screen.queryByText('private detail')).not.toBeInTheDocument();
    },
  );
});

test.each(['resolve', 'reject'])(
  'setup guidance ignores stale type %s after reopening',
  async settlement => {
    let resolveOld!: (value: { json: { result: [] } }) => void;
    let rejectOld!: (error: Error) => void;
    mockedGet
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve, reject) => {
          resolveOld = resolve;
          rejectOld = reject;
        }),
      )
      .mockResolvedValueOnce({
        json: {
          result: [
            {
              id: 'current',
              name: 'Current provider',
              description: 'Current prerequisites',
            },
          ],
        },
      });
    const { rerender } = render(
      <SemanticLayerModal {...props} semanticLayerUuid={undefined} />,
    );
    rerender(
      <SemanticLayerModal
        {...props}
        semanticLayerUuid={undefined}
        show={false}
      />,
    );
    rerender(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
    await act(async () => {
      if (settlement === 'resolve') resolveOld({ json: { result: [] } });
      else rejectOld(new Error('stale request'));
    });
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Semantic layer type' }),
    );
    fireEvent.click(await screen.findByText('Current provider'));
    expect(screen.getByText('Current prerequisites')).toBeInTheDocument();
    expect(
      screen.queryByText(/No semantic layer types are available/),
    ).not.toBeInTheDocument();
    expect(props.addDangerToast).not.toHaveBeenCalled();
  },
);

test('closing a mounted layer dialog suppresses a pending type-fetch failure', async () => {
  let rejectTypes!: (error: Error) => void;
  mockedGet.mockReset().mockReturnValue(
    new Promise((_, reject) => {
      rejectTypes = reject;
    }),
  );
  const { rerender } = render(
    <SemanticLayerModal {...props} semanticLayerUuid={undefined} />,
  );
  await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));

  rerender(
    <SemanticLayerModal
      {...props}
      semanticLayerUuid={undefined}
      show={false}
    />,
  );
  await act(async () => rejectTypes(new Error('late type failure')));

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('closing a mounted layer dialog suppresses a pending schema-fetch failure', async () => {
  let rejectSchema!: (error: Error) => void;
  mockedPost.mockReset().mockReturnValue(
    new Promise((_, reject) => {
      rejectSchema = reject;
    }),
  );
  const { rerender } = render(<SemanticLayerModal {...props} />);
  await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));

  rerender(<SemanticLayerModal {...props} show={false} />);
  await act(async () => rejectSchema(new Error('late schema failure')));

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('setup documentation stays available during schema loading and configuration', async () => {
  mockSemanticDocsUrl = 'https://docs.example.org/setup';
  mockedGet.mockReset().mockResolvedValue({
    json: { result: [{ id: 'current', name: 'Current provider' }] },
  });
  let resolveSchema!: (value: { json: { result: JsonSchema } }) => void;
  mockedPost.mockReset().mockReturnValue(
    new Promise(resolve => {
      resolveSchema = resolve;
    }),
  );
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Semantic layer type' }),
    ).toBeEnabled(),
  );
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(await screen.findByText('Current provider'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(
    screen.getByRole('link', { name: 'Semantic layer setup guide' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  await act(async () =>
    resolveSchema({ json: { result: { type: 'object', properties: {} } } }),
  );
  expect(
    await screen.findByRole('button', { name: 'Create' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Semantic layer setup guide' }),
  ).toBeInTheDocument();
});

test('canceling schema loading does not leave a reopened type picker spinning', async () => {
  mockedGet.mockReset().mockResolvedValue({
    json: { result: [{ id: 'current', name: 'Current provider' }] },
  });
  let resolveSchema!: (value: { json: { result: JsonSchema } }) => void;
  mockedPost.mockReset().mockReturnValue(
    new Promise(resolve => {
      resolveSchema = resolve;
    }),
  );
  const { rerender } = render(
    <SemanticLayerModal {...props} semanticLayerUuid={undefined} />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Semantic layer type' }),
    ).toBeEnabled(),
  );
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(await screen.findByText('Current provider'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  rerender(
    <SemanticLayerModal
      {...props}
      semanticLayerUuid={undefined}
      show={false}
    />,
  );
  rerender(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  expect(
    await screen.findByRole('combobox', { name: 'Semantic layer type' }),
  ).toBeEnabled();
  await act(async () =>
    resolveSchema({ json: { result: { type: 'object', properties: {} } } }),
  );
  expect(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  ).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Create' }),
  ).not.toBeInTheDocument();
});
