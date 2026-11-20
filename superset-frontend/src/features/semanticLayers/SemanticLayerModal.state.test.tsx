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
import type { JsonSchema } from '@jsonforms/core';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import SemanticLayerModal from './SemanticLayerModal';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const schema: JsonSchema = {
  type: 'object',
  required: ['account', 'warehouse'],
  properties: {
    account: { type: 'string', title: 'Account' },
    warehouse: { type: 'string', title: 'Warehouse' },
    password: { type: 'string', title: 'Password', format: 'password' },
  },
};
const dynamicSchema = {
  ...schema,
  properties: {
    ...schema.properties,
    database: {
      type: 'string',
      title: 'Database',
      'x-dynamic': true,
      'x-dependsOn': ['account'],
    },
  },
};
const props = {
  show: true,
  semanticLayerUuid: '11111111-1111-1111-1111-111111111111',
  onHide: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};
const get = jest.mocked(SupersetClient.get);
const post = jest.mocked(SupersetClient.post);
const put = jest.mocked(SupersetClient.put);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  put.mockResolvedValue({ json: {} } as never);
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function settle() {
  // JSON Forms emits model/validation changes after its 10ms debounce.
  for (let i = 0; i < 4; i += 1) {
    await act(async () => jest.advanceTimersByTime(10));
  }
}

async function setup(
  configuration: Record<string, unknown> = { account: 'initial' },
  configSchema = schema,
) {
  get.mockImplementation(
    async ({ endpoint }) =>
      ({
        json: {
          result:
            endpoint === '/api/v1/semantic_layer/types'
              ? [{ id: 'example', name: 'Example' }]
              : { name: 'Example', type: 'example', configuration },
        },
      }) as never,
  );
  post.mockResolvedValue({ json: { result: configSchema } } as never);
  const view = render(<SemanticLayerModal {...props} />);
  await settle();
  expect(screen.getByLabelText('Warehouse')).toBeInTheDocument();
  return view;
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function save(expected: Record<string, unknown>) {
  await settle();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(put).toHaveBeenCalledWith({
    endpoint: `/api/v1/semantic_layer/${props.semanticLayerUuid}`,
    jsonPayload: { name: 'Example', configuration: expected },
  });
  await settle();
}

test('a delayed parent echo cannot overwrite a newer field edit', async () => {
  await setup();
  change('Account', 'changed');
  act(() => {
    jest.advanceTimersByTime(10);
    change('Warehouse', 'typed');
  });
  expect(screen.getByLabelText('Warehouse')).toHaveValue('typed');
  await save({ account: 'changed', warehouse: 'typed' });
});

test.each([false, true])(
  'a schema refresh preserves an edit before its notification (changed schema: %s)',
  async changed => {
    await setup({ account: 'initial' }, dynamicSchema);
    let resolve!: (value: unknown) => void;
    post.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }) as never,
    );
    await act(async () => jest.advanceTimersByTime(500));
    expect(post).toHaveBeenCalledTimes(2);
    await act(async () => {
      change('Warehouse', 'typed');
      resolve({
        json: {
          result: changed
            ? {
                ...dynamicSchema,
                properties: {
                  ...dynamicSchema.properties,
                  database: {
                    ...dynamicSchema.properties?.database,
                    enum: ['one', 'two'],
                  },
                },
              }
            : dynamicSchema,
        },
      });
    });
    await save({ account: 'initial', warehouse: 'typed' });
  },
);

test('dependency clearing survives a newer unrelated edit', async () => {
  expect.hasAssertions();
  await setup(
    { account: 'initial', warehouse: 'old', database: 'old-db' },
    dynamicSchema,
  );
  change('Account', 'changed');
  act(() => {
    jest.advanceTimersByTime(10);
    change('Warehouse', 'typed');
  });
  await save({ account: 'changed', warehouse: 'typed', database: undefined });
});

test('dependency edits clear children before discovery and validate the cleared model', async () => {
  await setup(
    { account: 'initial', warehouse: 'wh', database: 'old-db' },
    {
      ...dynamicSchema,
      required: ['account', 'warehouse', 'database'],
    },
  );
  change('Account', 'changed');
  await settle();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await act(async () => jest.advanceTimersByTime(500));
  expect(post).toHaveBeenLastCalledWith({
    endpoint: '/api/v1/semantic_layer/schema/configuration',
    jsonPayload: {
      type: 'example',
      configuration: {
        account: 'changed',
        warehouse: 'wh',
        database: undefined,
      },
    },
  });
  change('Database', 'new-db');
  await save({ account: 'changed', warehouse: 'wh', database: 'new-db' });
});

test('Back resets configuration even with a pending field notification', async () => {
  get.mockResolvedValue({
    json: { result: [{ id: 'example', name: 'Example' }] },
  } as never);
  post.mockResolvedValue({ json: { result: schema } } as never);
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  await settle();
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(screen.getByText('Example'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await settle();
  change('Password', 'discarded');
  fireEvent.click(screen.getByRole('button', { name: /Back/ }));
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await settle();
  expect(screen.getByLabelText('Password')).toHaveValue('');
  change('Account', 'new');
  act(() => {
    jest.advanceTimersByTime(10);
    change('Warehouse', 'new-wh');
  });
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(post).toHaveBeenLastCalledWith({
    endpoint: '/api/v1/semantic_layer/',
    jsonPayload: {
      name: 'Example',
      type: 'example',
      configuration: { account: 'new', warehouse: 'new-wh' },
    },
  });
  await settle();
});

test.each(['', 'replacement'])(
  'a newer secret edit %j survives an older notification',
  async password => {
    expect.hasAssertions();
    await setup({
      account: 'initial',
      warehouse: 'wh',
      password: 'XXXXXXXXXX',
    });
    change('Account', 'changed');
    act(() => {
      jest.advanceTimersByTime(10);
      change('Password', password);
    });
    await save({ account: 'changed', warehouse: 'wh', password });
  },
);

test.each(['', 'replacement', 'XXXXXXXXXX'])(
  'schema refresh preserves the secret state %j',
  async password => {
    expect.hasAssertions();
    await setup(
      { account: 'initial', warehouse: 'wh', password: 'XXXXXXXXXX' },
      dynamicSchema,
    );
    let resolve!: (value: unknown) => void;
    post.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }) as never,
    );
    await act(async () => jest.advanceTimersByTime(500));
    await act(async () => {
      if (password !== 'XXXXXXXXXX') change('Password', password);
      resolve({ json: { result: dynamicSchema } });
    });
    await save({ account: 'initial', warehouse: 'wh', password });
  },
);

test('close and reopen hydrate the saved configuration, not unsaved secret edits', async () => {
  expect.hasAssertions();
  const view = await setup({
    account: 'initial',
    warehouse: 'wh',
    password: 'XXXXXXXXXX',
  });
  change('Password', 'unsaved');
  await settle();
  view.rerender(<SemanticLayerModal {...props} show={false} />);
  await settle();
  view.rerender(<SemanticLayerModal {...props} />);
  await settle();
  await save({ account: 'initial', warehouse: 'wh', password: 'XXXXXXXXXX' });
});

const backfillCases: {
  label: string;
  properties: NonNullable<JsonSchema['properties']>;
  dependency: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}[] = [
  {
    label: 'read-only default',
    properties: {
      account: { type: 'string', readOnly: true, default: 'locked' },
    },
    dependency: 'account',
    before: {},
    after: { account: 'locked' },
  },
  {
    label: 'top-level const',
    properties: { account: { type: 'string', const: 'locked' } },
    dependency: 'account',
    before: {},
    after: { account: 'locked' },
  },
  {
    label: 'nested const',
    properties: {
      credentials: {
        type: 'object',
        properties: {
          kind: { type: 'string', const: 'token' },
          token: { type: 'string', title: 'Token', format: 'password' },
        },
      },
    },
    dependency: 'credentials',
    before: { credentials: { token: 'XXXXXXXXXX' } },
    after: { credentials: { token: 'XXXXXXXXXX', kind: 'token' } },
  },
];

test.each(backfillCases)(
  '$label backfill keeps saved database and schema on edit',
  async ({ properties, dependency, before, after }) => {
    expect.hasAssertions();
    const dependent = {
      type: 'string',
      'x-dynamic': true,
      'x-dependsOn': [dependency],
    };
    await setup(
      { warehouse: 'wh', database: 'db', schema: 'public', ...before },
      {
        type: 'object',
        properties: {
          warehouse: { type: 'string', title: 'Warehouse' },
          ...properties,
          database: { ...dependent, title: 'Database' },
          schema: { ...dependent, title: 'Schema' },
        },
      },
    );
    await save({ warehouse: 'wh', database: 'db', schema: 'public', ...after });
  },
);

test('editing a self-dependent field preserves its own value', async () => {
  expect.hasAssertions();
  const selfDependentSchema = {
    ...dynamicSchema,
    properties: {
      ...dynamicSchema.properties,
      database: {
        ...dynamicSchema.properties.database,
        'x-dependsOn': ['database', 'account'],
      },
    },
  };
  await setup(
    { account: 'a', warehouse: 'wh', database: 'db' },
    selfDependentSchema,
  );
  change('Database', 'db2');
  await save({ account: 'a', warehouse: 'wh', database: 'db2' });
});

test('close resets configuration with a pending field notification', async () => {
  get.mockResolvedValue({
    json: { result: [{ id: 'example', name: 'Example' }] },
  } as never);
  post.mockResolvedValue({ json: { result: schema } } as never);
  const addProps = { ...props, semanticLayerUuid: undefined };
  const view = render(<SemanticLayerModal {...addProps} />);
  const add = async () => {
    await settle();
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: 'Semantic layer type' }),
    );
    fireEvent.click(screen.getAllByText('Example').at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settle();
  };
  await add();
  change('Password', 'discarded');
  view.rerender(<SemanticLayerModal {...addProps} show={false} />);
  await settle();
  view.rerender(<SemanticLayerModal {...addProps} />);
  await add();
  expect(screen.getByLabelText('Password')).toHaveValue('');
});

test('a schema backfill does not suppress a user dependency edit in the same tick', async () => {
  const credentials = {
    type: 'object',
    properties: {
      token: { type: 'string', title: 'Token', format: 'password' },
    },
  };
  const configSchema = {
    type: 'object',
    properties: {
      warehouse: { type: 'string', title: 'Warehouse' },
      credentials,
      database: {
        type: 'string',
        title: 'Database',
        'x-dynamic': true,
        'x-dependsOn': ['credentials'],
      },
    },
  };
  await setup(
    { warehouse: 'wh', credentials: { token: 'XXXXXXXXXX' }, database: 'db' },
    configSchema,
  );
  let resolve!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }) as never,
  );
  await act(async () => jest.advanceTimersByTime(500));
  expect(post).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolve({
      json: {
        result: {
          ...configSchema,
          properties: {
            ...configSchema.properties,
            credentials: {
              ...credentials,
              properties: {
                ...credentials.properties,
                kind: { type: 'string', const: 'token' },
              },
            },
          },
        },
      },
    });
    change('Token', 'replacement');
  });
  await save({
    warehouse: 'wh',
    credentials: { token: 'replacement', kind: 'token' },
    database: undefined,
  });
});

test('create mode still clears dependent selections on a real edit after backfill', async () => {
  get.mockResolvedValue({
    json: { result: [{ id: 'example', name: 'Example' }] },
  } as never);
  post.mockResolvedValue({
    json: {
      result: {
        ...dynamicSchema,
        properties: {
          ...dynamicSchema.properties,
          kind: { type: 'string', const: 'example' },
        },
      },
    },
  } as never);
  render(<SemanticLayerModal {...props} semanticLayerUuid={undefined} />);
  await settle();
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: 'Semantic layer type' }),
  );
  fireEvent.click(screen.getByText('Example'));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await settle();
  change('Account', 'a');
  change('Warehouse', 'wh');
  await settle();
  change('Database', 'db');
  await settle();
  change('Account', 'b');
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(post).toHaveBeenLastCalledWith({
    endpoint: '/api/v1/semantic_layer/',
    jsonPayload: {
      name: 'Example',
      type: 'example',
      configuration: {
        account: 'b',
        warehouse: 'wh',
        database: undefined,
        kind: 'example',
      },
    },
  });
  await settle();
});
