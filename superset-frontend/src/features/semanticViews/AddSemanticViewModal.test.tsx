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
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';

import {
  largeMetricEnum,
  largeRuntimeSchema,
} from 'src/features/semanticLayers/testFixtures';

import AddSemanticViewModal from './AddSemanticViewModal';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedGet = SupersetClient.get as jest.Mock;
const mockedPost = SupersetClient.post as jest.Mock;

const createProps = () => ({
  show: true,
  onHide: jest.fn(),
  onSuccess: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
});

const selectOption = async (name: string, optionLabel: string) => {
  const select = await screen.findByRole('combobox', { name });
  await userEvent.click(select);
  await userEvent.click(await screen.findByText(optionLabel));
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

test('loads layers on open and adds selected semantic views', async () => {
  mockedGet.mockResolvedValue({
    json: {
      result: [{ uuid: 'layer-1', name: 'Snowflake SL' }],
    },
  });

  mockedPost.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime') {
      return Promise.resolve({ json: { result: { properties: {} } } });
    }
    if (endpoint === '/api/v1/semantic_layer/layer-1/views') {
      return Promise.resolve({
        json: {
          result: [
            { name: 'orders', already_added: false },
            { name: 'customers', already_added: true },
          ],
        },
      });
    }
    if (endpoint === '/api/v1/semantic_view/') {
      return Promise.resolve({
        json: {
          result: {
            created: [{ uuid: 'view-1', name: 'orders' }],
          },
        },
      });
    }
    return Promise.reject(new Error(`Unexpected endpoint: ${endpoint}`));
  });

  const props = createProps();
  render(<AddSemanticViewModal {...props} />);

  await waitFor(() => {
    expect(mockedGet).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_layer/',
    });
  });

  await selectOption('Semantic layer', 'Snowflake SL');

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_layer/layer-1/schema/runtime',
      jsonPayload: {},
    });
  });

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_layer/layer-1/views',
      jsonPayload: { runtime_data: {} },
    });
  });

  await selectOption('Semantic views', 'orders');
  await userEvent.click(
    screen.getByRole('button', { name: /add 1 view\(s\)/i }),
  );

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/',
      jsonPayload: {
        views: [
          {
            name: 'orders',
            semantic_layer_uuid: 'layer-1',
            configuration: {},
          },
        ],
      },
    });
  });

  expect(props.addSuccessToast).toHaveBeenCalledWith(
    '1 semantic view(s) added',
  );
  expect(props.onSuccess).toHaveBeenCalled();
  expect(props.onHide).toHaveBeenCalled();
});

test('shows partial success feedback when only some semantic views are created', async () => {
  mockedGet.mockResolvedValue({
    json: {
      result: [{ uuid: 'layer-1', name: 'Snowflake SL' }],
    },
  });

  mockedPost.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime') {
      return Promise.resolve({ json: { result: { properties: {} } } });
    }
    if (endpoint === '/api/v1/semantic_layer/layer-1/views') {
      return Promise.resolve({
        json: {
          result: [
            { name: 'orders', already_added: false },
            { name: 'customers', already_added: false },
          ],
        },
      });
    }
    if (endpoint === '/api/v1/semantic_view/') {
      return Promise.resolve({
        json: {
          result: {
            created: [{ uuid: 'view-1', name: 'orders' }],
            errors: [{ name: 'customers', error: 'create failed' }],
          },
        },
      });
    }
    return Promise.reject(new Error(`Unexpected endpoint: ${endpoint}`));
  });

  const props = createProps();
  render(<AddSemanticViewModal {...props} />);

  await selectOption('Semantic layer', 'Snowflake SL');
  await waitFor(() => {
    expect(
      screen.getByRole('combobox', { name: 'Semantic views' }),
    ).toBeInTheDocument();
  });

  await selectOption('Semantic views', 'orders');
  await selectOption('Semantic views', 'customers');
  await userEvent.click(
    screen.getByRole('button', { name: /add 2 view\(s\)/i }),
  );

  await waitFor(() => {
    expect(props.addSuccessToast).toHaveBeenCalledWith(
      '1 semantic view(s) added',
    );
    expect(props.addDangerToast).toHaveBeenCalledWith(
      '1 semantic view(s) failed to add: customers',
    );
  });
  expect(props.onSuccess).not.toHaveBeenCalled();
  expect(props.onHide).not.toHaveBeenCalled();
});

test('shows toast when loading semantic layers fails', async () => {
  mockedGet.mockRejectedValue(new Error('boom'));
  const props = createProps();

  render(<AddSemanticViewModal {...props} />);

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'An error occurred while fetching semantic layers',
    );
  });
});

test('shows toast when add semantic views fails', async () => {
  mockedGet.mockResolvedValue({
    json: {
      result: [{ uuid: 'layer-1', name: 'Snowflake SL' }],
    },
  });

  mockedPost.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime') {
      return Promise.resolve({ json: { result: { properties: {} } } });
    }
    if (endpoint === '/api/v1/semantic_layer/layer-1/views') {
      return Promise.resolve({
        json: {
          result: [{ name: 'orders', already_added: false }],
        },
      });
    }
    if (endpoint === '/api/v1/semantic_view/') {
      return Promise.reject(new Error('save failed'));
    }
    return Promise.reject(new Error(`Unexpected endpoint: ${endpoint}`));
  });

  const props = createProps();
  render(<AddSemanticViewModal {...props} />);

  await selectOption('Semantic layer', 'Snowflake SL');
  await waitFor(() => {
    expect(
      screen.getByRole('combobox', { name: 'Semantic views' }),
    ).toBeInTheDocument();
  });

  await selectOption('Semantic views', 'orders');
  await userEvent.click(
    screen.getByRole('button', { name: /add 1 view\(s\)/i }),
  );

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'An error occurred while adding semantic views',
    );
  });
});

// ---------------------------------------------------------------------------
// Large-catalog / refresh-stability regression tests (sc-107832)
// ---------------------------------------------------------------------------

/**
 * Runtime schema whose metrics field is a dependency of a dynamic field, so
 * every metrics selection triggers the debounced schema-refresh cycle — the
 * shape that made per-selection refreshes remount the form pre-fix.
 */
const dynamicMetricsSchema = {
  properties: {
    metrics: {
      type: 'array',
      items: { enum: ['m1', 'm2', 'm3'] },
    },
    dimensions: {
      type: 'array',
      items: { enum: ['d1', 'd2'] },
      'x-dynamic': true,
      'x-dependsOn': ['metrics'],
    },
  },
};

/**
 * Same metrics picker without the dynamic dependency: selections trigger no
 * schema-refresh cycle, so tests that only care about form-state wiring wait
 * on a single debounce instead of one per pick.
 */
const staticMetricsSchema = {
  properties: {
    metrics: {
      type: 'array',
      items: { enum: ['m1', 'm2', 'm3'] },
    },
  },
};

const pickFromSelect = async (name: RegExp, optionTitle: string) => {
  const box = await screen.findByRole('combobox', { name });
  await userEvent.click(box);
  const option = await waitFor(() => {
    const el = Array.from(
      document.querySelectorAll('.ant-select-item-option'),
    ).find(e => e.getAttribute('title') === optionTitle);
    if (!el) throw new Error(`option ${optionTitle} not rendered yet`);
    return el as HTMLElement;
  });
  await userEvent.click(option);
};

const selectedTag = (title: string) =>
  document.querySelector(`.ant-select-selection-item[title="${title}"]`);

const mockLayerWithSchema = (
  schema: Record<string, unknown>,
  overrides: Record<string, (payload?: unknown) => Promise<unknown>> = {},
) => {
  mockedGet.mockResolvedValue({
    json: { result: [{ uuid: 'layer-1', name: 'Snowflake SL' }] },
  });
  mockedPost.mockImplementation(
    ({ endpoint, jsonPayload }: { endpoint: string; jsonPayload: unknown }) => {
      if (overrides[endpoint]) return overrides[endpoint](jsonPayload);
      if (endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime') {
        return Promise.resolve({ json: { result: schema } });
      }
      if (endpoint === '/api/v1/semantic_layer/layer-1/views') {
        return Promise.resolve({
          json: { result: [{ name: 'orders', already_added: false }] },
        });
      }
      if (endpoint === '/api/v1/semantic_view/') {
        return Promise.resolve({
          json: { result: { created: [{ uuid: 'view-1', name: 'orders' }] } },
        });
      }
      return Promise.reject(new Error(`Unexpected endpoint: ${endpoint}`));
    },
  );
};

test('metric selections survive identical schema refreshes without losing state', async () => {
  mockLayerWithSchema(dynamicMetricsSchema);
  render(<AddSemanticViewModal {...createProps()} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  await pickFromSelect(/metrics/i, 'm1');
  // The debounced refresh fires and returns a payload identical to the
  // current schema; the form must not remount and the selection must hold.
  await waitFor(
    () => {
      const refreshCalls = mockedPost.mock.calls.filter(
        ([{ endpoint, jsonPayload }]) =>
          endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime' &&
          (jsonPayload as { runtime_data?: unknown })?.runtime_data,
      );
      expect(refreshCalls.length).toBeGreaterThanOrEqual(1);
    },
    { timeout: 10000 },
  );
  expect(selectedTag('m1')).toBeTruthy();

  await pickFromSelect(/metrics/i, 'm2');
  await waitFor(
    () => {
      expect(selectedTag('m2')).toBeTruthy();
    },
    { timeout: 10000 },
  );
  // Both selections intact after two refresh cycles.
  expect(selectedTag('m1')).toBeTruthy();
});

test('a const array default does not loop updates', async () => {
  mockLayerWithSchema({
    properties: {
      marker: { const: [] },
      metrics: { type: 'array', items: { enum: ['m1', 'm2'] } },
    },
  });
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  try {
    render(<AddSemanticViewModal {...createProps()} />);
    await selectOption('Semantic layer', 'Snowflake SL');

    // Pre-fix, ConstControl's reference comparison re-fired handleChange on
    // every cycle for an array const → "Maximum update depth exceeded".
    expect(
      await screen.findByRole('combobox', { name: /metrics/i }),
    ).toBeInTheDocument();
    expect(
      consoleError.mock.calls.find(args =>
        String(args[0]).includes('Maximum update depth'),
      ),
    ).toBeUndefined();
  } finally {
    consoleError.mockRestore();
  }
});

test('a failed schema refresh surfaces a toast and preserves selections', async () => {
  let refreshCount = 0;
  mockLayerWithSchema(dynamicMetricsSchema, {
    '/api/v1/semantic_layer/layer-1/schema/runtime': (payload: unknown) => {
      if ((payload as { runtime_data?: unknown })?.runtime_data) {
        refreshCount += 1;
        return Promise.reject(new Error('refresh boom'));
      }
      return Promise.resolve({ json: { result: dynamicMetricsSchema } });
    },
  });
  const props = createProps();
  render(<AddSemanticViewModal {...props} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  await pickFromSelect(/metrics/i, 'm1');
  await waitFor(
    () => {
      expect(props.addDangerToast).toHaveBeenCalledWith(
        'An error occurred while refreshing the runtime schema',
      );
    },
    { timeout: 10000 },
  );
  expect(refreshCount).toBeGreaterThanOrEqual(1);
  // The user's selection is untouched by the failure (spec FR-005).
  expect(selectedTag('m1')).toBeTruthy();
});

test('the save payload carries every selected metric', async () => {
  // Static schema on purpose: this test pins the form-state -> payload
  // wiring, not the refresh cycle (covered by the refresh tests above), so
  // it waits on one views-fetch debounce rather than one per pick.
  mockLayerWithSchema(staticMetricsSchema);
  render(<AddSemanticViewModal {...createProps()} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  await pickFromSelect(/metrics/i, 'm1');
  await pickFromSelect(/metrics/i, 'm2');
  await pickFromSelect(/metrics/i, 'm3');

  await waitFor(
    () => {
      expect(
        screen.getByRole('combobox', { name: 'Semantic views' }),
      ).toBeEnabled();
    },
    { timeout: 10000 },
  );
  await pickFromSelect(/semantic views/i, 'orders');
  await userEvent.click(
    screen.getByRole('button', { name: /add 1 view\(s\)/i }),
  );

  // Every selected metric reaches the persistence payload untruncated
  // (spec FR-004; the 500-value propagation itself is pinned at the
  // control level in MultiEnumControl.test.tsx).
  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/',
      jsonPayload: {
        views: [
          {
            name: 'orders',
            semantic_layer_uuid: 'layer-1',
            configuration: expect.objectContaining({
              metrics: ['m1', 'm2', 'm3'],
            }),
          },
        ],
      },
    });
  });
});

test('renders and selects within a 500-metric runtime schema', async () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  mockLayerWithSchema(largeRuntimeSchema as Record<string, unknown>);
  render(<AddSemanticViewModal {...createProps()} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  const metricsBox = await screen.findByRole('combobox', { name: /metrics/i });
  await userEvent.click(metricsBox);
  await userEvent.type(metricsBox, largeMetricEnum[42]);
  const option = await waitFor(() => {
    const el = Array.from(
      document.querySelectorAll('.ant-select-item-option'),
    ).find(e => e.getAttribute('title') === largeMetricEnum[42]);
    if (!el) throw new Error('option not rendered yet');
    return el as HTMLElement;
  });
  await userEvent.click(option);
  expect(selectedTag(largeMetricEnum[42])).toBeTruthy();

  // largeRuntimeSchema's dimensions field depends on metrics, so the pick
  // schedules a refresh — wait for it so the dedupe/apply path is exercised
  // at 500-metric scale rather than ending before the debounce elapses.
  await waitFor(
    () => {
      const refreshes = mockedPost.mock.calls.filter(
        ([{ endpoint, jsonPayload }]) =>
          endpoint === '/api/v1/semantic_layer/layer-1/schema/runtime' &&
          (jsonPayload as { runtime_data?: unknown })?.runtime_data,
      );
      expect(refreshes.length).toBeGreaterThanOrEqual(1);
    },
    { timeout: 10000 },
  );
  expect(selectedTag(largeMetricEnum[42])).toBeTruthy();
  expect(
    consoleErrorSpy.mock.calls.find(args =>
      String(args[0]).includes('Maximum update depth'),
    ),
  ).toBeUndefined();
});

test('a persistently failing refresh retries once, not on every edit', async () => {
  let refreshCount = 0;
  mockLayerWithSchema(dynamicMetricsSchema, {
    '/api/v1/semantic_layer/layer-1/schema/runtime': (payload: unknown) => {
      if ((payload as { runtime_data?: unknown })?.runtime_data) {
        refreshCount += 1;
        return Promise.reject(new Error('refresh boom'));
      }
      return Promise.resolve({ json: { result: dynamicMetricsSchema } });
    },
  });
  const props = createProps();
  render(<AddSemanticViewModal {...props} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  await pickFromSelect(/metrics/i, 'm1');
  await waitFor(() => expect(refreshCount).toBe(1), { timeout: 10000 });

  // One bounded retry for this dependency state, then no further attempts
  // however many more edits the user makes during the outage.
  await pickFromSelect(/dimensions/i, 'd1');
  await waitFor(() => expect(refreshCount).toBe(2), { timeout: 10000 });
  await pickFromSelect(/dimensions/i, 'd2');
  await new Promise(resolve => {
    setTimeout(resolve, 1200);
  });
  expect(refreshCount).toBe(2);
  // And the user was told once, not once per attempt.
  expect(
    props.addDangerToast.mock.calls.filter(([msg]) =>
      String(msg).includes('refreshing the runtime schema'),
    ),
  ).toHaveLength(1);
});

test('a superseded refresh response cannot toast or clobber a newer one', async () => {
  // Exercises schemaRefreshGenRef: when two refreshes overlap and the older
  // one settles last, its failure must be ignored — no error toast, and no
  // rollback of the dependency snapshot the newer request committed.
  let call = 0;
  const resolvers: Array<() => void> = [];
  mockLayerWithSchema(dynamicMetricsSchema, {
    '/api/v1/semantic_layer/layer-1/schema/runtime': (payload: unknown) => {
      if (!(payload as { runtime_data?: unknown })?.runtime_data) {
        return Promise.resolve({ json: { result: dynamicMetricsSchema } });
      }
      call += 1;
      if (call === 1) {
        // First (soon-to-be superseded) refresh: fails, but only after the
        // second one has already been issued.
        return new Promise((_resolve, reject) => {
          resolvers.push(() => reject(new Error('stale refresh boom')));
        });
      }
      return Promise.resolve({ json: { result: dynamicMetricsSchema } });
    },
  });
  const props = createProps();
  render(<AddSemanticViewModal {...props} />);
  await selectOption('Semantic layer', 'Snowflake SL');

  await pickFromSelect(/metrics/i, 'm1');
  await waitFor(() => expect(call).toBe(1), { timeout: 10000 });
  // Second selection supersedes the in-flight refresh.
  await pickFromSelect(/metrics/i, 'm2');
  await waitFor(() => expect(call).toBe(2), { timeout: 10000 });
  // Now let the stale first request fail, last.
  resolvers.forEach(fn => fn());
  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });

  expect(
    props.addDangerToast.mock.calls.filter(([msg]) =>
      String(msg).includes('refreshing the runtime schema'),
    ),
  ).toHaveLength(0);
  expect(selectedTag('m1')).toBeTruthy();
  expect(selectedTag('m2')).toBeTruthy();
});
