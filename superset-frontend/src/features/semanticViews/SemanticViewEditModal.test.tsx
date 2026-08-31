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
    get: jest.fn(),
  },
  getClientErrorObject: jest.fn(() => Promise.resolve({ error: '' })),
}));

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
