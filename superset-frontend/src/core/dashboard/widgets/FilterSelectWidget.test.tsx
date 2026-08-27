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
import { dashboard as dashboardApi } from '@apache-superset/core';
import {
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import DashboardProvider from '../DashboardProvider';
import { registerBuiltInWidgets } from '../registerBuiltInWidgets';
import { FILTER_BAR_APPLY_EVENT } from '../filterVocabulary';
import FilterSelectWidget from './FilterSelectWidget';

const provider = DashboardProvider.getInstance();

// Every test below authors a static `options` list, so this response is
// never actually read — but `useDistinctColumnValues` still fires the
// request unconditionally (see its own comment), and an unmocked one would
// otherwise fail noisily against jsdom's fetch.
fetchMock.get(/\/api\/v1\/datasource\/table\/\d+\/column\/[^/]+\/values\/$/, {
  result: [],
});

beforeAll(() => {
  registerBuiltInWidgets();
});

beforeEach(() => {
  provider.reset();
});

const DATASET_ID = 7;
const COLUMN = 'region';

/** A filter.select node under `parentId`, already targeting a column with a fixed static option list — no distinct-values fetch needed. */
const createFilter = (parentId: string): string =>
  provider.addWidget(parentId, 0, {
    type: 'filter.select',
    props: {
      datasetId: DATASET_ID,
      column: COLUMN,
      options: ['east', 'west'],
    },
  });

const pickWest = () => selectOption('west', `Filter by ${COLUMN}`);

test('a standalone filter emits immediately on selection', async () => {
  const rootId = provider.getRoot().id;
  const filterId = createFilter(rootId);
  render(<FilterSelectWidget nodeId={filterId} />);

  await pickWest();

  await waitFor(() => {
    const value = provider.getValue(
      filterId,
      dashboardApi.VALUE_CHANGED_EVENT,
    ) as {
      selection: string[];
    };
    expect(value.selection).toEqual(['west']);
  });
});

test('a filter inside a filter.bar holds its selection until the bar applies', async () => {
  const rootId = provider.getRoot().id;
  const barId = provider.addWidget(rootId, 0, { type: 'filter.bar' });
  const filterId = createFilter(barId);
  render(<FilterSelectWidget nodeId={filterId} />);

  await pickWest();

  // The pick registers in the control immediately...
  expect(screen.getByRole('option', { name: 'west' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // ...but nothing has been emitted for any query-bound consumer to read yet.
  expect(
    provider.getValue(filterId, dashboardApi.VALUE_CHANGED_EVENT),
  ).toBeUndefined();

  provider.emit(barId, FILTER_BAR_APPLY_EVENT, {});

  await waitFor(() => {
    const value = provider.getValue(
      filterId,
      dashboardApi.VALUE_CHANGED_EVENT,
    ) as {
      selection: string[];
    };
    expect(value.selection).toEqual(['west']);
  });
});

test("a bar's apply does not affect a filter untouched since the last apply", async () => {
  const rootId = provider.getRoot().id;
  const barId = provider.addWidget(rootId, 0, { type: 'filter.bar' });
  const filterId = createFilter(barId);
  render(<FilterSelectWidget nodeId={filterId} />);

  // Never interacted with — applying the bar must not manufacture a commit
  // for a filter with nothing pending.
  provider.emit(barId, FILTER_BAR_APPLY_EVENT, {});

  expect(
    provider.getValue(filterId, dashboardApi.VALUE_CHANGED_EVENT),
  ).toBeUndefined();
});

test("a different bar's apply does not affect this filter", async () => {
  const rootId = provider.getRoot().id;
  const barId = provider.addWidget(rootId, 0, { type: 'filter.bar' });
  const otherBarId = provider.addWidget(rootId, 1, {
    type: 'filter.bar',
  });
  const filterId = createFilter(barId);
  render(<FilterSelectWidget nodeId={filterId} />);

  await pickWest();
  provider.emit(otherBarId, FILTER_BAR_APPLY_EVENT, {});

  // Still nothing committed — the event named a different bar than this
  // filter's own parent.
  expect(
    provider.getValue(filterId, dashboardApi.VALUE_CHANGED_EVENT),
  ).toBeUndefined();
});
