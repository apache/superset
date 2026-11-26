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
import {
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import {
  MainPreset,
  LAST_YEAR_FAILURE,
  LIMITS_FAILED,
  mockServer,
  selectFilter,
  renderModal,
  saveButton,
  flush,
  rename,
  payload,
  policy,
  rule,
} from './FiltersConfigForm.timeRangeLimits.testHelpers';

beforeAll(() => {
  new MainPreset().register();
  fetchMock.mockGlobal();
});

beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
});

afterEach(() => {
  jest.restoreAllMocks();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

const preFiltered = (timeRange: string) => ({
  ...selectFilter('NATIVE_FILTER-S1'),
  time_range: timeRange,
});

const preFilterSlot = () =>
  waitFor(() => {
    const picker = screen
      .getAllByTestId(DateFilterTestKey.PopoverOverlay)
      .find(element =>
        element.closest('.ant-form-item')?.textContent?.includes('Time range'),
      );
    expect(picker).toBeDefined();
    return picker!.closest('.ant-form-item') as HTMLElement;
  });

async function rangeTypes(slot: HTMLElement) {
  await userEvent.click(
    within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
  );
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('combobox', { name: /^Range type/ }));
  await waitFor(() =>
    expect(
      document.querySelector('.ant-select-dropdown-list'),
    ).toBeInTheDocument(),
  );
  return Array.from(
    document.querySelectorAll(
      '.ant-select-dropdown-list .ant-select-item-option',
    ),
  ).map(option => option.textContent);
}

test('the pre-filter time range picker follows the limits', async () => {
  mockServer();
  renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });

  const options = await rangeTypes(await preFilterSlot());

  expect(options).not.toContain('No filter');
  expect(options).toContain('Advanced');
});

test('a pre-filter time range past the limits shows the reason and blocks Save', async () => {
  mockServer();
  const onSave = renderModal([preFiltered('Last year')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  await userEvent.click(saveButton());

  const message = await within(slot).findByText(
    LAST_YEAR_FAILURE,
    {},
    { timeout: 3000 },
  );
  expect(message.closest('[role="alert"]')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(
        within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
      ).getByRole('button'),
    ).toHaveAttribute('aria-describedby', expect.stringContaining(message.id)),
  );
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test('a pre-filter time range within the limits saves', async () => {
  mockServer();
  const onSave = renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  await preFilterSlot();

  await rename();
  await userEvent.click(saveButton());

  await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 3000 });
  expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument();
});

const twoDatasetLimits = () =>
  payload(policy(), {
    datasets: [
      {
        id: 1,
        name: 'birth_names',
        policy: policy({ max_span: rule(90, 'P1D') }),
      },
      {
        id: 2,
        name: 'second_table',
        policy: policy({ max_span: rule(7, 'P1D') }),
      },
    ],
  });

test("only the filter's own dataset limits apply to its pre-filter", async () => {
  mockServer({ limits: twoDatasetLimits() });
  const onSave = renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  await preFilterSlot();

  await rename();
  await userEvent.click(saveButton());

  await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 3000 });
  expect(screen.queryByText(/Longer than/)).not.toBeInTheDocument();
});

test("a pre-filter past its own dataset's limit still blocks Save", async () => {
  mockServer({ limits: twoDatasetLimits() });
  const onSave = renderModal([preFiltered('Last year')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  await userEvent.click(saveButton());

  const message = await within(slot).findByText(
    /Longer than .*90 days/,
    {},
    { timeout: 3000 },
  );
  expect(message.closest('[role="alert"]')).toBeInTheDocument();
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

const DATASET_LIMITS = 'glob:*/api/v1/dataset/1/time_range_limits/';

function mockFilterOnlyDataset(answer: object | number = 200) {
  fetchMock.get(
    DATASET_LIMITS,
    typeof answer === 'number' && answer !== 200
      ? answer
      : {
          result: {
            schema_version: 1,
            global_revision: 0,
            global: policy(),
            dataset: policy({ max_span: rule(90, 'P1D') }),
          },
        },
  );
  mockServer({ limits: payload(policy()) });
}

test('a filter-only dataset missing from the dashboard limits still caps the picker', async () => {
  mockFilterOnlyDataset();
  renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DATASET_LIMITS).length).toBe(1),
  );
  await flush();
  const options = await rangeTypes(await preFilterSlot());

  expect(options).not.toContain('No filter');
  expect(options).toContain('Advanced');
});

test("a pre-filter past a filter-only dataset's limit blocks Save", async () => {
  mockFilterOnlyDataset();
  const onSave = renderModal([preFiltered('Last year')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  await userEvent.click(saveButton());

  const message = await within(slot).findByText(
    /Longer than .*90 days/,
    {},
    { timeout: 3000 },
  );
  expect(message.closest('[role="alert"]')).toBeInTheDocument();
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test("a filter-only dataset's limits that can't be loaded block Save", async () => {
  mockFilterOnlyDataset(503);
  const onSave = renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  await rename();
  await userEvent.click(saveButton());

  expect(
    await within(slot).findByText(LIMITS_FAILED, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test("a filter-only dataset's limits load on a retry after a failure", async () => {
  let calls = 0;
  let recovered = false;
  fetchMock.get(DATASET_LIMITS, () => {
    calls += 1;
    return !recovered
      ? 503
      : {
          result: {
            schema_version: 1,
            global_revision: 0,
            global: policy(),
            dataset: policy({ max_span: rule(90, 'P1D') }),
          },
        };
  });
  mockServer({ limits: payload(policy()) });
  const onSave = renderModal([preFiltered('Last year')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  // The client retries a 503 three times; the first lookup has given up after
  // its fourth call.
  await waitFor(() => expect(calls).toBe(4), { timeout: 10000 });
  await flush();
  const failedCalls = calls;
  recovered = true;
  await rename();
  await userEvent.click(saveButton());

  const message = await within(slot).findByText(
    /Longer than .*90 days/,
    {},
    { timeout: 3000 },
  );
  expect(calls).toBe(failedCalls + 1);
  expect(
    within(
      within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
    ).getByRole('button'),
  ).toHaveAttribute('aria-describedby', expect.stringContaining(message.id));
  await flush();
  expect(onSave).not.toHaveBeenCalled();
  const options = await rangeTypes(slot);
  expect(options).not.toContain('No filter');
});

test('a listed dataset whose policy failed to load blocks Save', async () => {
  mockServer({
    limits: payload(policy(), {
      datasets: [
        {
          id: 1,
          name: 'birth_names',
          policy: null,
          error: {
            message: 'Time range limits could not be verified.',
            error_type: 'TIME_RANGE_LIMITS_UNAVAILABLE_ERROR',
          },
        },
      ],
    }),
  });
  const onSave = renderModal([preFiltered('Last month')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  const slot = await preFilterSlot();
  await rename();
  await userEvent.click(saveButton());

  expect(
    await within(slot).findByText(LIMITS_FAILED, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test('with limits off the pre-filter picker still offers "No filter"', async () => {
  window.featureFlags = {};
  mockServer();
  renderModal([preFiltered('Last year')], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });

  const options = await rangeTypes(await preFilterSlot());

  expect(options).toContain('No filter');
  expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument();
});
