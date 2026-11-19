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
/**
 * Validates PR review items #2 and #7:
 *  - chip removal must dispatch a dataMask update so charts re-query
 *    (otherwise the URL changes but the synthetic Rison filter keeps
 *    influencing chart results until full reload).
 *  - the chip list must react to URL changes (back/forward navigation or
 *    a programmatic history.replace), not snapshot the URL at mount.
 */
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { act, render, screen, userEvent } from 'spec/helpers/testing-library';
import { REMOVE_DATA_MASK, UPDATE_DATA_MASK } from 'src/dataMask/actions';
import { RISON_UNMATCHED_DATAMASK_ID } from 'src/dashboard/util/risonFilters';
import UrlFiltersVertical from './Vertical';

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
}));

const seedUrl = (search: string) => {
  // jsdom doesn't navigate, so set both window.location (read by
  // getRisonFilterParam) and react-router's in-memory history.
  window.history.replaceState({}, '', `/superset/dashboard/1/${search}`);
};

const renderAt = (search: string) => {
  seedUrl(search);
  const history = createMemoryHistory({
    initialEntries: [`/superset/dashboard/1/${search}`],
  });
  const utils = render(
    <Router history={history}>
      <UrlFiltersVertical />
    </Router>,
    { useRedux: true },
  );
  return { ...utils, history };
};

beforeEach(() => {
  mockDispatch.mockReset();
  window.history.replaceState({}, '', '/');
});

test('renders chips parsed from the f= URL param', () => {
  renderAt('?f=(region:EMEA,channel:web)');

  expect(screen.getByText('URL Filters')).toBeInTheDocument();
  expect(screen.getByText('region')).toBeInTheDocument();
  expect(screen.getByText('EMEA')).toBeInTheDocument();
  expect(screen.getByText('channel')).toBeInTheDocument();
  expect(screen.getByText('web')).toBeInTheDocument();
});

test('renders nothing when there is no f= param', () => {
  renderAt('');

  expect(screen.queryByText('URL Filters')).not.toBeInTheDocument();
});

test('removing a chip dispatches updateDataMask with the remaining filters', async () => {
  renderAt('?f=(region:EMEA,channel:web)');

  const closeButtons = screen.getAllByRole('button', { name: /close/i });
  expect(closeButtons).toHaveLength(2);
  await userEvent.click(closeButtons[0]);

  // The remaining filter must still apply to charts, so updateDataMask
  // (not removeDataMask) is dispatched with one filter left.
  const updateCalls = mockDispatch.mock.calls
    .map(([action]) => action)
    .filter(action => action?.type === UPDATE_DATA_MASK);
  expect(updateCalls).toHaveLength(1);
  expect(updateCalls[0].filterId).toBe(RISON_UNMATCHED_DATAMASK_ID);
  expect(updateCalls[0].dataMask.extraFormData.filters).toHaveLength(1);
  expect(updateCalls[0].dataMask.extraFormData.filters[0]).toMatchObject({
    col: 'channel',
    val: ['web'],
  });

  // The chip we clicked is gone from the UI.
  expect(screen.queryByText('region')).not.toBeInTheDocument();
});

test('removing the last chip dispatches removeDataMask, not an empty update', async () => {
  renderAt('?f=(region:EMEA)');

  await userEvent.click(screen.getByRole('button', { name: /close/i }));

  const removeCalls = mockDispatch.mock.calls
    .map(([action]) => action)
    .filter(action => action?.type === REMOVE_DATA_MASK);
  expect(removeCalls).toHaveLength(1);
  expect(removeCalls[0].filterId).toBe(RISON_UNMATCHED_DATAMASK_ID);

  // No stray updateDataMask with empty filters.
  const updateCalls = mockDispatch.mock.calls
    .map(([action]) => action)
    .filter(action => action?.type === UPDATE_DATA_MASK);
  expect(updateCalls).toHaveLength(0);
});

test('chip list re-renders when the URL changes (popstate/programmatic nav)', () => {
  const { history } = renderAt('?f=(region:EMEA)');

  expect(screen.getByText('region')).toBeInTheDocument();
  expect(screen.queryByText('priority')).not.toBeInTheDocument();

  // Simulate a programmatic URL change (e.g. via history.push or a back/
  // forward nav). The component must re-read the URL filters.
  act(() => {
    seedUrl('?f=(priority:high)');
    history.replace('/superset/dashboard/1/?f=(priority:high)');
  });

  expect(screen.getByText('priority')).toBeInTheDocument();
  expect(screen.getByText('high')).toBeInTheDocument();
  expect(screen.queryByText('region')).not.toBeInTheDocument();
});
