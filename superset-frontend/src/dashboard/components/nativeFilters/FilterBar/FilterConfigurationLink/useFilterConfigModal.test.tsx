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
import { act, renderHook } from '@testing-library/react';
import { createStore, createWrapper } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { SaveChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { useFilterConfigModal } from './useFilterConfigModal';

const DASHBOARD_ID = 7;
const FILTERS_URL = `glob:*/api/v1/dashboard/${DASHBOARD_ID}/filters*`;
const CUSTOMIZATIONS_URL = `glob:*/api/v1/dashboard/${DASHBOARD_ID}/chart_customizations*`;

// An ordinary dataset filter: the save path never reads the datasource type,
// so a semantic view behaves identically here.
const NEW_FILTER = {
  id: 'NATIVE_FILTER-new',
  name: 'Region',
  type: 'NATIVE_FILTER',
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'region' } }],
  controlValues: {},
  cascadeParentIds: [],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
};

const NEW_CUSTOMIZATION = {
  id: 'CHART_CUSTOMIZATION-new',
  name: 'Time grain',
  type: 'CHART_CUSTOMIZATION',
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
};

const CHANGES = {
  filterChanges: { modified: [NEW_FILTER], deleted: [], reordered: [] },
  customizationChanges: {
    modified: [NEW_CUSTOMIZATION],
    deleted: [],
    reordered: [],
  },
} as unknown as SaveChangesType;

const initialState = {
  dashboardInfo: {
    id: DASHBOARD_ID,
    metadata: {
      native_filter_configuration: [],
      chart_customization_config: [],
    },
  },
  nativeFilters: { filters: {} },
  dataMask: {},
};

const renderUseFilterConfigModal = () => {
  const store = createStore(initialState, reducerIndex);
  return {
    store,
    ...renderHook(() => useFilterConfigModal({ dashboardId: DASHBOARD_ID }), {
      wrapper: createWrapper({ store }),
    }),
  };
};

// Let both thunks run as far as they can without advancing timers.
const flush = async () => {
  for (let i = 0; i < 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const deferred = () => {
  let release: () => void = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
};

afterEach(() => fetchMock.clearHistory().removeRoutes());

test.each([
  [403, 'you do not have permission to edit this dashboard.', false],
  [404, 'this dashboard is unavailable or you no longer have access.', false],
  [500, 'Internal Server Error', false],
  [403, 'you do not have permission to edit this dashboard.', true],
  [404, 'this dashboard is unavailable or you no longer have access.', true],
  [500, 'Internal Server Error', true],
] as const)(
  'names the failed save for HTTP %s (%s), partial failure=%s',
  async (status, reason, failControls) => {
    fetchMock.clearHistory().removeRoutes();
    const failure = {
      status,
      body: { message: status === 500 ? reason : 'NOT FOUND' },
    };
    fetchMock.route(
      FILTERS_URL,
      failControls ? { result: [NEW_FILTER] } : failure,
    );
    fetchMock.route(CUSTOMIZATIONS_URL, failure);
    const { result, store, unmount } = renderUseFilterConfigModal();
    act(() => result.current.openFilterConfigModal());
    await act(async () => {
      await expect(result.current.handleSave(CHANGES)).rejects.toBeDefined();
    });
    expect(result.current.isFilterConfigModalOpen).toBe(true);
    expect(fetchMock.callHistory.calls(CUSTOMIZATIONS_URL)).toHaveLength(
      failControls ? 1 : 0,
    );
    expect(store.getState()).toMatchObject({
      messageToasts: [
        {
          text: `Your ${failControls ? 'display control' : 'filter'} changes were not saved: ${reason}`,
        },
      ],
    });
    unmount();
  },
);

test.each([false, true])(
  'renders the endpoint validation dict, display controls=%s',
  async failControls => {
    // Both endpoints return 400 for schema errors and 422 for dataset validation.
    const detail = failControls
      ? 'Field may not be null.'
      : 'The native filters reference datasets that are not available: 42';
    const failure = {
      status: failControls ? 400 : 422,
      body: {
        message: failControls
          ? { modified: [detail] }
          : { native_filter_configuration: [detail] },
      },
    };
    fetchMock.route(
      FILTERS_URL,
      failControls ? { result: [NEW_FILTER] } : failure,
    );
    fetchMock.route(CUSTOMIZATIONS_URL, failure);
    const { result, store } = renderUseFilterConfigModal();
    await act(async () => {
      await expect(result.current.handleSave(CHANGES)).rejects.toBeDefined();
    });
    expect(store.getState()).toMatchObject({
      messageToasts: [
        {
          text: `Your ${failControls ? 'display control' : 'filter'} changes were not saved: ${detail}`,
        },
      ],
    });
  },
);

test('saves native filters before chart customizations instead of in parallel', async () => {
  const events: string[] = [];
  const filters = deferred();

  fetchMock.route(FILTERS_URL, async () => {
    events.push('filters:request');
    await filters.promise;
    events.push('filters:response');
    return { result: [NEW_FILTER] };
  });
  fetchMock.route(CUSTOMIZATIONS_URL, async () => {
    events.push('customizations:request');
    return { result: [NEW_CUSTOMIZATION] };
  });

  const { result } = renderUseFilterConfigModal();

  let saving: Promise<void> | undefined;
  await act(async () => {
    saving = result.current.handleSave(CHANGES);
    await flush();
  });

  // The customizations save must not have started while the filters save is
  // still in flight: both endpoints rewrite the same dashboard json_metadata.
  expect(events).toEqual(['filters:request']);

  await act(async () => {
    filters.release();
    await saving;
  });

  expect(events).toEqual([
    'filters:request',
    'filters:response',
    'customizations:request',
  ]);
});

test('keeps both a new filter and a new display control saved together', async () => {
  // Both endpoints read the whole json_metadata document, change one key and
  // write the document back, so a save that overlaps another one loses it.
  let stored: Record<string, unknown[]> = {
    native_filter_configuration: [],
    chart_customization_config: [],
  };
  const filters = deferred();
  const customizations = deferred();

  fetchMock.route(FILTERS_URL, async () => {
    const read = { ...stored };
    await filters.promise;
    stored = {
      ...read,
      native_filter_configuration: [
        ...read.native_filter_configuration,
        NEW_FILTER,
      ],
    };
    return { result: stored.native_filter_configuration };
  });
  fetchMock.route(CUSTOMIZATIONS_URL, async () => {
    const read = { ...stored };
    await customizations.promise;
    stored = {
      ...read,
      chart_customization_config: [
        ...read.chart_customization_config,
        NEW_CUSTOMIZATION,
      ],
    };
    return { result: stored.chart_customization_config };
  });

  const { result } = renderUseFilterConfigModal();

  let saving: Promise<void> | undefined;
  await act(async () => {
    saving = result.current.handleSave(CHANGES);
    await flush();
  });

  await act(async () => {
    filters.release();
    await flush();
    customizations.release();
    await saving;
  });

  expect(stored.native_filter_configuration).toEqual([NEW_FILTER]);
  expect(stored.chart_customization_config).toEqual([NEW_CUSTOMIZATION]);
});

test('does not save chart customizations when the filter save fails', async () => {
  fetchMock.route(FILTERS_URL, 500);
  fetchMock.route(CUSTOMIZATIONS_URL, { result: [NEW_CUSTOMIZATION] });

  const { result, store } = renderUseFilterConfigModal();

  act(() => {
    result.current.openFilterConfigModal();
  });
  expect(result.current.isFilterConfigModalOpen).toBe(true);

  await act(async () => {
    // The failure reaches the config modal, which keeps the unsaved items.
    await expect(result.current.handleSave(CHANGES)).rejects.toBeDefined();
  });

  expect(fetchMock.callHistory.calls(CUSTOMIZATIONS_URL)).toHaveLength(0);
  // The modal stays open so the unsaved configuration is not silently lost,
  // and the failure is reported rather than swallowed.
  expect(result.current.isFilterConfigModalOpen).toBe(true);
  const { messageToasts } = store.getState() as unknown as {
    messageToasts: unknown[];
  };
  expect(messageToasts).toHaveLength(1);
});
