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
import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';

import SemanticViewEditModal from './SemanticViewEditModal';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    put: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
  },
  getClientErrorObject: jest.fn(() => Promise.resolve({ error: '' })),
}));

const mockedPost = SupersetClient.post as jest.Mock;
const mockedPut = SupersetClient.put as jest.Mock;
const mockedGet = SupersetClient.get as jest.Mock;
const mockedGetClientErrorObject = getClientErrorObject as jest.Mock;

const MOCK_STRUCTURE = {
  result: {
    // Matches createProps() so tests that are not about hydration keep
    // asserting the same values whichever source the form reads from.
    description: 'old description',
    cache_timeout: 60,
    dimensions: [
      {
        name: 'order_date',
        type: 'timestamp[us]',
        definition: 'ordered_at',
        description: 'Date of the order',
        grain: 'Day',
      },
      {
        name: 'customer_id',
        type: 'int64',
        definition: null,
        description: null,
        grain: null,
      },
    ],
    metrics: [
      {
        name: 'orders',
        type: 'double',
        definition: 'SIMPLE',
        description: 'Order count',
      },
    ],
  },
};

const createProps = () => ({
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  semanticView: {
    id: 7,
    table_name: 'orders_semantic_view',
    description: 'old description',
    cache_timeout: 60,
  },
});

beforeEach(() => {
  mockedPut.mockReset();
  mockedPost.mockReset();
  mockedGet.mockReset();
  mockedGetClientErrorObject.mockReset();
  mockedGetClientErrorObject.mockResolvedValue({ error: '' });
  mockedGet.mockResolvedValue({ json: MOCK_STRUCTURE });
});

test('saves semantic view and refreshes list', async () => {
  mockedPut.mockResolvedValue({});
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  // Wait for structure fetch to complete so save button is enabled
  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalled();
  });
  // Wait for the tab content to render (structure loaded)
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: 'old description',
        cache_timeout: 60,
      },
    });
  });
  expect(props.addSuccessToast).toHaveBeenCalledWith('Semantic view updated');
  expect(props.onSave).toHaveBeenCalled();
  expect(props.onHide).toHaveBeenCalled();
});

test('shows backend error toast when save fails', async () => {
  mockedPut.mockRejectedValue(new Error('save failed'));
  mockedGetClientErrorObject.mockResolvedValue({
    error: 'Semantic view failed to save',
  });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  // Wait for structure fetch to complete so save button is enabled
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
  });

  // Reset the mock so we only catch the save error, not the structure fetch
  mockedGetClientErrorObject.mockResolvedValue({
    error: 'Semantic view failed to save',
  });

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Semantic view failed to save',
    );
  });
});

test('fetches structure on mount', async () => {
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7/structure',
    });
  });
});

// sc-107904: the caller passes its own copy of description/cache_timeout, and
// that copy goes stale as soon as this modal saves — Explore feeds the
// pre-edit datasource straight back into the store. The modal must therefore
// hydrate the Details tab from /structure, not from the prop.
test('hydrates Details from the server, not the stale caller prop', async () => {
  mockedGet.mockResolvedValue({
    json: {
      result: {
        ...MOCK_STRUCTURE.result,
        description: 'saved on the server',
        cache_timeout: 900,
      },
    },
  });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(screen.getByDisplayValue('saved on the server')).toBeInTheDocument();
  });
  expect(screen.queryByDisplayValue('old description')).not.toBeInTheDocument();

  mockedPut.mockResolvedValue({});
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: 'saved on the server',
        cache_timeout: 900,
      },
    });
  });
});

test('preserves unsaved edits when the parent recreates its props', async () => {
  const props = createProps();
  const { rerender } = render(<SemanticViewEditModal {...props} />);

  const description = await screen.findByDisplayValue('old description');
  await userEvent.clear(description);
  await userEvent.type(description, 'unsaved edit');

  rerender(
    <SemanticViewEditModal
      {...props}
      semanticView={{
        ...props.semanticView,
        description: 'changed parent value',
        cache_timeout: 120,
      }}
    />,
  );

  expect(screen.getByDisplayValue('unsaved edit')).toBeInTheDocument();
});

test('hydrates null description and cache timeout from the server', async () => {
  mockedGet.mockResolvedValue({
    json: {
      result: {
        ...MOCK_STRUCTURE.result,
        description: null,
        cache_timeout: null,
      },
    },
  });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  mockedPut.mockResolvedValue({});
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: null,
        cache_timeout: null,
      },
    });
  });
});

test('keeps prop-seeded values when the server omits the editable fields', async () => {
  // An older backend (deploy skew) returns structure without description /
  // cache_timeout. Hydration must not blank the form — otherwise a save
  // right after would silently null the user's persisted description.
  const { dimensions, metrics } = MOCK_STRUCTURE.result;
  mockedGet.mockResolvedValue({ json: { result: { dimensions, metrics } } });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  mockedPut.mockResolvedValue({});
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
  expect(screen.getByDisplayValue('old description')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: 'old description',
        cache_timeout: 60,
      },
    });
  });
});

test('falls back to the caller prop when the structure fetch fails', async () => {
  mockedGet.mockRejectedValue(new Error('structure failed'));
  mockedGetClientErrorObject.mockResolvedValue({ error: 'boom' });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith('boom');
  });
  expect(screen.getByDisplayValue('old description')).toBeInTheDocument();
});

test('fetches and displays dimensions tab', async () => {
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalled();
  });

  const dimensionsTab = screen.getByRole('tab', { name: /dimensions/i });
  expect(dimensionsTab).toBeInTheDocument();
  expect(dimensionsTab).toHaveTextContent('2');

  await userEvent.click(dimensionsTab);

  await waitFor(() => {
    expect(screen.getByText('order_date')).toBeInTheDocument();
  });
  expect(screen.getByText('customer_id')).toBeInTheDocument();
  expect(screen.getByText('timestamp[us]')).toBeInTheDocument();
});

test('fetches and displays metrics tab', async () => {
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalled();
  });

  const metricsTab = screen.getByRole('tab', { name: /metrics/i });
  expect(metricsTab).toBeInTheDocument();
  expect(metricsTab).toHaveTextContent('1');

  await userEvent.click(metricsTab);

  await waitFor(() => {
    expect(screen.getByText('orders')).toBeInTheDocument();
  });
  expect(screen.getByText('SIMPLE')).toBeInTheDocument();
  expect(screen.getByText('Order count')).toBeInTheDocument();
});

test('shows info alert in structure tabs', async () => {
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalled();
  });

  await userEvent.click(screen.getByRole('tab', { name: /dimensions/i }));

  await waitFor(() => {
    expect(
      screen.getByText(
        'Structure is managed by the upstream semantic layer and is read-only.',
      ),
    ).toBeInTheDocument();
  });
});

test('handles structure fetch error', async () => {
  mockedGet.mockRejectedValue(new Error('fetch failed'));
  mockedGetClientErrorObject.mockResolvedValue({
    error: 'Failed to load structure',
  });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Failed to load structure',
    );
  });
});

test('does not toast if the fetch is cancelled while formatting its error', async () => {
  let resolveClientError: (value: { error: string }) => void = () => {};
  mockedGet.mockRejectedValue(new Error('fetch failed'));
  mockedGetClientErrorObject.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveClientError = resolve;
      }),
  );
  const props = createProps();
  const { rerender } = render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGetClientErrorObject).toHaveBeenCalled();
  });
  rerender(<SemanticViewEditModal {...props} show={false} />);
  await act(async () => {
    resolveClientError({ error: 'Failed to load structure' });
  });

  expect(props.addDangerToast).not.toHaveBeenCalled();
});

test('clears structure loading when the semantic view is removed', async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));
  const props = createProps();
  const { rerender } = render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  rerender(<SemanticViewEditModal {...props} semanticView={null} />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});

test('details tab save still works after viewing structure tabs', async () => {
  mockedPut.mockResolvedValue({});
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalled();
  });

  // Navigate to dimensions tab and back to details
  await userEvent.click(screen.getByRole('tab', { name: /dimensions/i }));
  await userEvent.click(screen.getByRole('tab', { name: /details/i }));

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: 'old description',
        cache_timeout: 60,
      },
    });
  });
  expect(props.addSuccessToast).toHaveBeenCalledWith('Semantic view updated');
});

// ---------------------------------------------------------------------------
// Large-catalog structure rendering (sc-107832 / spec US2)
// ---------------------------------------------------------------------------

const LARGE_STRUCTURE = {
  result: {
    description: 'old description',
    cache_timeout: 60,
    dimensions: Array.from({ length: 500 }, (_, i) => ({
      name: `dim_${String(i).padStart(3, '0')}`,
      type: 'string',
      definition: null,
      description: null,
      grain: null,
    })),
    metrics: Array.from({ length: 500 }, (_, i) => ({
      name: `metric_${String(i).padStart(3, '0')}`,
      type: 'double',
      definition: 'SIMPLE',
      description: null,
    })),
  },
};

test('renders a 500-metric structure paginated instead of unbounded', async () => {
  mockedGet.mockResolvedValue({ json: LARGE_STRUCTURE });
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  try {
    render(<SemanticViewEditModal {...createProps()} />);

    // Tab labels report the full counts.
    await userEvent.click(await screen.findByText('Metrics (500)'));
    // Pagination caps the rendered rows: first page only, not all 500.
    await waitFor(() => {
      expect(screen.getByText('metric_000')).toBeInTheDocument();
    });
    expect(screen.queryByText('metric_499')).not.toBeInTheDocument();
    const rows = document.querySelectorAll('.ant-table-tbody tr');
    expect(rows.length).toBeLessThanOrEqual(101);
    expect(
      consoleError.mock.calls.find(args =>
        String(args[0]).includes('Maximum update depth'),
      ),
    ).toBeUndefined();
  } finally {
    consoleError.mockRestore();
  }
});

test('keeps small structures unpaginated', async () => {
  render(<SemanticViewEditModal {...createProps()} />);
  await userEvent.click(await screen.findByText('Metrics (1)'));
  await waitFor(() => {
    expect(screen.getByText('orders')).toBeInTheDocument();
  });
  expect(document.querySelector('.ant-pagination')).toBeNull();
});

const SYNC_STRUCTURE = {
  result: {
    ...MOCK_STRUCTURE.result,
    uuid: 'bd2f07da-c65e-40da-b75e-c62b7cdd67f1',
    can_refresh_metadata: true,
    metrics: ['orders', 'revenue', 'customers', 'returns'].map(name => ({
      ...MOCK_STRUCTURE.result.metrics[0],
      name,
    })),
  },
};
const SYNCED_STRUCTURE = {
  result: {
    ...SYNC_STRUCTURE.result,
    description: 'Must not replace a draft',
    cache_timeout: 999,
    metrics: [
      ...SYNC_STRUCTURE.result.metrics,
      { ...MOCK_STRUCTURE.result.metrics[0], name: 'new_metric' },
    ],
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('Sync metadata lives beside the tabs and preserves drafts and active tab without Save', async () => {
  mockedGet
    .mockResolvedValueOnce({ json: SYNC_STRUCTURE })
    .mockResolvedValueOnce({ json: SYNCED_STRUCTURE });
  mockedPost.mockResolvedValue({
    json: { result: { status: 'changed', revision: 'new' } },
  });
  const props = {
    ...createProps(),
    onMetadataSync: jest.fn(),
    addDangerToast: undefined,
    addSuccessToast: undefined,
  };
  render(<SemanticViewEditModal {...props} />);
  const sync = await screen.findByRole('button', { name: 'Sync metadata' });
  expect(sync.closest('.ant-tabs-nav')).not.toBeNull();
  await userEvent.clear(screen.getByRole('textbox'));
  await userEvent.type(screen.getByRole('textbox'), 'My draft');
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), '42');
  await userEvent.click(screen.getByRole('tab', { name: 'Metrics (4)' }));
  await userEvent.click(sync);
  expect(
    await screen.findByRole('tab', { name: 'Metrics (5)', selected: true }),
  ).toBeInTheDocument();
  expect(screen.getByText('new_metric')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Metadata synced');
  expect(mockedPost).toHaveBeenCalledWith({
    endpoint: `/api/v1/semantic_view/${SYNC_STRUCTURE.result.uuid}/refresh_metadata/`,
    jsonPayload: {},
  });
  await userEvent.click(screen.getByRole('tab', { name: 'Details' }));
  expect(screen.getByRole('textbox')).toHaveValue('My draft');
  expect(screen.getByRole('spinbutton')).toHaveValue('42');
  expect(props.onMetadataSync).toHaveBeenCalledTimes(1);
  expect(props.onSave).not.toHaveBeenCalled();
  expect(props.onHide).not.toHaveBeenCalled();
  expect(mockedPut).not.toHaveBeenCalled();
});

test.each([
  { ...SYNC_STRUCTURE.result, uuid: undefined },
  { ...SYNC_STRUCTURE.result, can_refresh_metadata: false },
  MOCK_STRUCTURE.result,
])(
  'missing UUID or server capability hides sync regardless of title',
  async result => {
    mockedGet.mockResolvedValue({ json: { result } });
    const props = createProps();
    props.semanticView.table_name = 'dbt Semantic Layer';
    render(<SemanticViewEditModal {...props} />);
    await screen.findByRole('tab', { name: 'Details' });
    expect(
      screen.queryByRole('button', { name: 'Sync metadata' }),
    ).not.toBeInTheDocument();
  },
);

test('published metadata with failed reload retries only GET and keeps the modal open', async () => {
  mockedGet
    .mockResolvedValueOnce({ json: SYNC_STRUCTURE })
    .mockRejectedValueOnce(new Error('reload'))
    .mockResolvedValueOnce({ json: SYNCED_STRUCTURE });
  mockedPost.mockResolvedValue({ json: { result: { status: 'changed' } } });
  const props = {
    ...createProps(),
    onMetadataSync: jest.fn(),
    addDangerToast: undefined,
  };
  render(<SemanticViewEditModal {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Metadata synced; unable to reload fields',
  );
  expect(props.onMetadataSync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Reload fields' }));
  await screen.findByRole('tab', { name: 'Metrics (5)' });
  expect(mockedPost).toHaveBeenCalledTimes(1);
  expect(mockedGet).toHaveBeenCalledTimes(3);
  expect(props.onMetadataSync).toHaveBeenCalledTimes(1);
  expect(props.onHide).not.toHaveBeenCalled();
});

test('pending sync disables duplicate actions and Save', async () => {
  mockedGet.mockResolvedValue({ json: SYNC_STRUCTURE });
  const pending = deferred<object>();
  mockedPost.mockReturnValue(pending.promise);
  render(<SemanticViewEditModal {...createProps()} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  expect(screen.getByRole('button', { name: 'Sync metadata' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Sync metadata' }));
  expect(mockedPost).toHaveBeenCalledTimes(1);
  await act(async () =>
    pending.resolve({ json: { result: { status: 'unchanged' } } }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Metadata is up to date',
  );
});

test('closing and reopening the same view suppresses a stale publication callback', async () => {
  mockedGet.mockResolvedValue({ json: SYNC_STRUCTURE });
  const pending = deferred<object>();
  mockedPost.mockReturnValue(pending.promise);
  const props = { ...createProps(), onMetadataSync: jest.fn() };
  const { rerender } = render(<SemanticViewEditModal {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  rerender(<SemanticViewEditModal {...props} show={false} />);
  rerender(<SemanticViewEditModal {...props} />);
  await screen.findByRole('button', { name: 'Sync metadata' });
  await act(async () =>
    pending.resolve({ json: { result: { status: 'changed' } } }),
  );
  expect(mockedGet).toHaveBeenCalledTimes(2);
  expect(props.onMetadataSync).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('sync failure is announced inline and preserves drafts without a structure reload', async () => {
  mockedGet.mockResolvedValue({ json: SYNC_STRUCTURE });
  mockedPost.mockRejectedValue(new Error('upstream'));
  mockedGetClientErrorObject.mockResolvedValue({
    message: 'The catalog is unavailable',
  });
  const props = { ...createProps(), addDangerToast: undefined };
  render(<SemanticViewEditModal {...props} />);
  const button = await screen.findByRole('button', { name: 'Sync metadata' });
  await userEvent.type(screen.getByRole('textbox'), ' edited');
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The catalog is unavailable',
  );
  expect(screen.getByRole('textbox')).toHaveValue('old description edited');
  expect(mockedGet).toHaveBeenCalledTimes(1);
  expect(mockedPost).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('a stale reload cannot replace a different view or notify its caller', async () => {
  const pending = deferred<object>();
  mockedGet
    .mockResolvedValueOnce({ json: SYNC_STRUCTURE })
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ json: SYNC_STRUCTURE });
  mockedPost.mockResolvedValue({ json: { result: { status: 'changed' } } });
  const props = { ...createProps(), onMetadataSync: jest.fn() };
  const { rerender } = render(<SemanticViewEditModal {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  rerender(
    <SemanticViewEditModal
      {...props}
      semanticView={{ ...props.semanticView, id: 8 }}
    />,
  );
  await screen.findByRole('button', { name: 'Sync metadata' });
  await act(async () => pending.resolve({ json: SYNCED_STRUCTURE }));
  expect(screen.getByRole('tab', { name: 'Metrics (4)' })).toBeInTheDocument();
  expect(props.onMetadataSync).not.toHaveBeenCalled();
});

test('late error parsing and finally cannot unlock a newer sync in a reopened session', async () => {
  const parsed = deferred<{ message: string }>();
  const current = deferred<object>();
  mockedGet.mockResolvedValue({ json: SYNC_STRUCTURE });
  mockedPost
    .mockRejectedValueOnce(new Error('old'))
    .mockReturnValueOnce(current.promise);
  mockedGetClientErrorObject.mockReturnValueOnce(parsed.promise);
  const props = createProps();
  const { rerender } = render(<SemanticViewEditModal {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  await waitFor(() => expect(mockedGetClientErrorObject).toHaveBeenCalled());
  rerender(<SemanticViewEditModal {...props} show={false} />);
  rerender(<SemanticViewEditModal {...props} />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Sync metadata' }),
  );
  await act(async () => parsed.resolve({ message: 'old error' }));
  expect(screen.queryByText('old error')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Sync metadata' }));
  expect(mockedPost).toHaveBeenCalledTimes(2);
  await act(async () =>
    current.resolve({ json: { result: { status: 'unchanged' } } }),
  );
});
