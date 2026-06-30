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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import { extraQueryEditor1, initialState } from 'src/SqlLab/fixtures';
import { newQueryTabName } from 'src/SqlLab/utils/newQueryTabName';
import { Store } from 'redux';
import { RootState } from 'src/views/store';
import { QueryEditor } from 'src/SqlLab/types';
import { commands, menus } from 'src/core';
import { ViewLocations } from 'src/SqlLab/contributions';

jest.mock('src/SqlLab/components/SqlEditor', () =>
  // eslint-disable-next-line react/display-name
  ({ queryEditor }: { queryEditor: QueryEditor }) => (
    <div data-test="mock-sql-editor">{queryEditor.id}</div>
  ),
);

const setup = (overridesStore?: Store, initialState?: RootState) =>
  render(<TabbedSqlEditors />, {
    useRedux: true,
    initialState,
    ...(overridesStore && { store: overridesStore }),
  });

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/*', {});
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('should removeQueryEditor', async () => {
  const { getByRole, getAllByRole, queryByText } = setup(
    undefined,
    initialState,
  );
  const tabCount = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  ).length;
  const tabList = getByRole('tablist');
  const closeButton = tabList.getElementsByTagName('button')[0];
  expect(closeButton).toBeInTheDocument();
  if (closeButton) {
    fireEvent.click(closeButton);
  }
  await waitFor(() =>
    expect(
      getAllByRole('tab').filter(
        tab => !tab.classList.contains('ant-tabs-tab-remove'),
      ).length,
    ).toEqual(tabCount - 1),
  );
  expect(
    queryByText(initialState.sqlLab.queryEditors[0].name),
  ).not.toBeInTheDocument();
});

test('should add new query editor', async () => {
  const { getAllByLabelText, getAllByRole } = setup(undefined, initialState);
  const tabCount = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  ).length;
  fireEvent.click(getAllByLabelText('Add tab')[0]);
  await waitFor(() =>
    expect(
      getAllByRole('tab').filter(
        tab => !tab.classList.contains('ant-tabs-tab-remove'),
      ).length,
    ).toEqual(tabCount + 1),
  );
  expect(
    getAllByRole('tab').filter(
      tab => !tab.classList.contains('ant-tabs-tab-remove'),
    )[tabCount],
  ).toHaveTextContent(/Untitled Query (\d+)+/);
});

test('should properly increment query tab name', async () => {
  const { getAllByLabelText, getAllByRole } = setup(undefined, initialState);
  const tabCount = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  ).length;
  const newTitle = newQueryTabName(initialState.sqlLab.queryEditors);
  fireEvent.click(getAllByLabelText('Add tab')[0]);
  await waitFor(() =>
    expect(
      getAllByRole('tab').filter(
        tab => !tab.classList.contains('ant-tabs-tab-remove'),
      ).length,
    ).toEqual(tabCount + 1),
  );
  expect(
    getAllByRole('tab').filter(
      tab => !tab.classList.contains('ant-tabs-tab-remove'),
    )[tabCount],
  ).toHaveTextContent(newTitle);
});

test('should handle select', async () => {
  const { getAllByRole } = setup(undefined, initialState);
  const tabs = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  );
  fireEvent.click(tabs[1]);
  await screen.findByText(extraQueryEditor1.id);
  expect(screen.getByText(extraQueryEditor1.id)).toBeInTheDocument();
});

test('should render', () => {
  const { getAllByRole } = setup(undefined, initialState);
  const tabs = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  );
  expect(tabs).toHaveLength(initialState.sqlLab.queryEditors.length);
});

test('should disable new tab when offline', () => {
  const { queryAllByLabelText } = setup(undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      offline: true,
    },
  });
  expect(queryAllByLabelText('Add tab').length).toEqual(0);
});

test('should have an empty state when query editors is empty', async () => {
  const { getByText, getByRole } = setup(undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [
        {
          id: 1,
          name: 'Untitled Query 1',
          sql: '',
        },
      ],
      tabHistory: [],
    },
  });

  // Clear the new tab applied in componentDidMount and check the state of the empty tab
  const removeTabButton = getByRole('tab', { name: 'remove' });
  fireEvent.click(removeTabButton);

  await waitFor(() =>
    expect(getByText('Add a new tab to create SQL Query')).toBeInTheDocument(),
  );
});

// The new-tab "+" button (NewTabButton) opens a dropdown of contributed
// actions when an extension registers something under sqllab.newTab, and
// otherwise falls back to adding a SQL editor tab directly. These tests cover
// that branching plus the resilience to a contributed-but-unregistered command.
const newTabDisposables: ReturnType<typeof menus.registerMenuItem>[] = [];

afterEach(() => {
  while (newTabDisposables.length) {
    newTabDisposables.pop()?.dispose();
  }
});

const contributeNewTabItem = (command: string) =>
  newTabDisposables.push(
    menus.registerMenuItem(
      { view: 'builtin.editor', command },
      ViewLocations.sqllab.newTab,
      'primary',
    ),
  );

test('new tab button opens a dropdown listing SQL Editor and the contributed item', async () => {
  contributeNewTabItem('ext.newTab');
  newTabDisposables.push(
    commands.registerCommand(
      { id: 'ext.newTab', title: 'Contributed Tab' },
      jest.fn(),
    ),
  );

  setup(undefined, initialState);

  fireEvent.click(screen.getAllByLabelText('Add tab')[0]);

  expect(await screen.findByText('SQL Editor')).toBeInTheDocument();
  expect(screen.getByText('Contributed Tab')).toBeInTheDocument();
});

test('new tab button runs the contributed command when its menu item is clicked', async () => {
  const handler = jest.fn();
  contributeNewTabItem('ext.newTab');
  newTabDisposables.push(
    commands.registerCommand(
      { id: 'ext.newTab', title: 'Contributed Tab' },
      handler,
    ),
  );

  setup(undefined, initialState);

  fireEvent.click(screen.getAllByLabelText('Add tab')[0]);
  fireEvent.click(await screen.findByText('Contributed Tab'));

  await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
});

test('new tab button adds a tab directly when there are no contributions', async () => {
  const { getAllByLabelText, getAllByRole, queryByText } = setup(
    undefined,
    initialState,
  );
  const tabCount = getAllByRole('tab').filter(
    tab => !tab.classList.contains('ant-tabs-tab-remove'),
  ).length;

  fireEvent.click(getAllByLabelText('Add tab')[0]);

  // No dropdown appears; a new editor tab is created immediately.
  expect(queryByText('SQL Editor')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      getAllByRole('tab').filter(
        tab => !tab.classList.contains('ant-tabs-tab-remove'),
      ).length,
    ).toEqual(tabCount + 1),
  );
});

test('new tab button skips a contributed item whose command is not registered', async () => {
  // Menu item registered, but its command never is — the item must be dropped
  // rather than throwing "Command not found" when the dropdown renders.
  contributeNewTabItem('ext.missing');

  setup(undefined, initialState);

  fireEvent.click(screen.getAllByLabelText('Add tab')[0]);

  expect(await screen.findByText('SQL Editor')).toBeInTheDocument();
  expect(screen.queryByText('ext.missing')).not.toBeInTheDocument();
});
