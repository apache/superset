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
import { act } from '@testing-library/react';
import { render, screen, within } from 'spec/helpers/testing-library';
import {
  registerTestView,
  registerTestViewContainer,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';
import { ViewLocations } from 'src/SqlLab/contributions';
import { resetLeftBarViews } from 'src/SqlLab/components/SqlEditorLeftBar/builtins';
import { initialState } from 'src/SqlLab/fixtures';
import { EMPTY_STATE_QE_ID } from 'src/SqlLab/hooks/useQueryEditor';
import { resetLeftBarLayoutState } from 'src/SqlLab/hooks/useLeftBarLayout';
import { resetLeftBarViewSettings } from 'src/SqlLab/hooks/useLeftBarViewSettings';
import {
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
} from 'src/SqlLab/hooks/useManageableLeftBarEntries';
import SqlEditorLeftBar from '.';

const mockTabExplorerMount = jest.fn();
const mockTabExplorerUnmount = jest.fn();
jest.mock('../TabExplorer', () => ({
  __esModule: true,
  default: ({ queryEditorId }: { queryEditorId: string }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks, global-require
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      mockTabExplorerMount();
      return mockTabExplorerUnmount;
    }, []);
    return (
      <div data-test="mock-tab-explorer" data-query-editor-id={queryEditorId} />
    );
  },
}));

jest.mock('../DatabaseSelectorPopover', () => ({
  __esModule: true,
  default: ({
    queryEditorId,
    compact,
  }: {
    queryEditorId: string;
    compact?: boolean;
  }) => (
    <div
      data-test="mock-database-selector-popover"
      data-query-editor-id={queryEditorId}
      data-compact={String(!!compact)}
    />
  ),
}));

const makeTrigger = (label: string) => () => <span>{label}</span>;
const makePanel = (testId: string, text: string) => () => (
  <div data-test={testId}>{text}</div>
);

const registerLeftBarView = (
  id: string,
  name: string,
  icon: () => JSX.Element,
  panel: () => JSX.Element,
) => {
  registerTestViewContainer(ViewLocations.sqllab.leftSidebar, id, name, icon);
  registerTestView(id, id, name, panel);
};

// Explorer's registered view derives the active query editor id from
// redux's tabHistory itself (see builtins.tsx), rather than through a prop
// threaded by SqlEditorLeftBar — so every render here needs a store.
const stateWithActiveTab = (id: string | undefined) => ({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    tabHistory: id === undefined ? [] : [id],
  },
});

beforeEach(() => {
  resetLeftBarViews();
  resetLeftBarLayoutState();
  resetLeftBarViewSettings();
  mockTabExplorerMount.mockClear();
  mockTabExplorerUnmount.mockClear();
});

afterEach(cleanupExtensions);

test('normalizes an empty active tab to EMPTY_STATE_QE_ID', () => {
  render(<SqlEditorLeftBar queryEditorId="" />, {
    useRedux: true,
    initialState: stateWithActiveTab(undefined),
  });

  expect(screen.getByTestId('mock-tab-explorer')).toHaveAttribute(
    'data-query-editor-id',
    EMPTY_STATE_QE_ID,
  );
});

test('renders TabExplorer by default and never renders a menu itself (the rail lives in AppLayout)', () => {
  render(<SqlEditorLeftBar queryEditorId="qe1" />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByTestId('mock-tab-explorer')).toBeInTheDocument();
});

test('renders the extension panel when its view is active', () => {
  registerLeftBarView(
    'ext.a',
    'Ext A',
    makeTrigger('A'),
    makePanel('panel-a', 'Panel A'),
  );
  resetLeftBarLayoutState({ activeViewId: 'ext.a' });

  render(<SqlEditorLeftBar queryEditorId="qe1" />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });

  expect(screen.getByTestId('panel-a')).toBeInTheDocument();
  expect(screen.queryByTestId('mock-tab-explorer')).not.toBeInTheDocument();
});

test('a crashing panel is contained and does not crash the component', () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  const Crashing = () => {
    throw new Error('boom');
  };
  registerLeftBarView('ext.crash', 'Crash', makeTrigger('C'), Crashing);
  resetLeftBarLayoutState({ activeViewId: 'ext.crash' });

  expect(() =>
    render(<SqlEditorLeftBar queryEditorId="qe1" />, {
      useRedux: true,
      initialState: stateWithActiveTab('qe1'),
    }),
  ).not.toThrow();
  expect(
    screen.getByTestId('left-bar-panel-slot-ext.crash'),
  ).toBeInTheDocument();

  consoleErrorSpy.mockRestore();
});

test('falls back to Explorer when the persisted active view id is no longer registered', () => {
  registerLeftBarView(
    'ext.a',
    'Ext A',
    makeTrigger('A'),
    makePanel('panel-a', 'Panel A'),
  );
  resetLeftBarLayoutState({ activeViewId: 'ext.gone' });

  render(<SqlEditorLeftBar queryEditorId="qe1" />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });

  expect(screen.getByTestId('mock-tab-explorer')).toBeInTheDocument();
  expect(screen.queryByTestId('panel-a')).not.toBeInTheDocument();
});

test('renders the Settings panel, listing every registered view, when Settings is active', () => {
  registerLeftBarView(
    'ext.a',
    'Ext A',
    makeTrigger('A'),
    makePanel('panel-a', 'Panel A'),
  );
  registerLeftBarView(
    'ext.b',
    'Ext B',
    makeTrigger('B'),
    makePanel('panel-b', 'Panel B'),
  );
  resetLeftBarLayoutState({ activeViewId: TAB_SETTINGS_ID });

  render(<SqlEditorLeftBar queryEditorId="qe1" />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });

  const settingsPanel = within(
    screen.getByTestId('left-bar-view-settings-panel'),
  );
  expect(settingsPanel.getByText('Ext A')).toBeInTheDocument();
  expect(settingsPanel.getByText('Ext B')).toBeInTheDocument();
});

test('does not remount a panel when switching to a different rail view and back, so its own local UI state persists', () => {
  registerLeftBarView(
    'ext.a',
    'Ext A',
    makeTrigger('A'),
    makePanel('panel-a', 'Panel A'),
  );

  render(<SqlEditorLeftBar queryEditorId="qe1" />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });
  expect(mockTabExplorerMount).toHaveBeenCalledTimes(1);

  // Switch away to a different rail view — Explorer's slot stays mounted,
  // just hidden, rather than being unmounted.
  act(() => {
    resetLeftBarLayoutState({ activeViewId: 'ext.a' });
  });
  expect(screen.getByTestId('panel-a')).toBeInTheDocument();
  expect(mockTabExplorerUnmount).not.toHaveBeenCalled();

  // Switch back — a genuine remount would call the mount effect again.
  act(() => {
    resetLeftBarLayoutState({ activeViewId: TAB_EXPLORER_ID });
  });
  expect(mockTabExplorerMount).toHaveBeenCalledTimes(1);
  expect(mockTabExplorerUnmount).not.toHaveBeenCalled();
});

test('collapsed prop renders only the compact database selector', () => {
  render(<SqlEditorLeftBar queryEditorId="qe1" collapsed />, {
    useRedux: true,
    initialState: stateWithActiveTab('qe1'),
  });

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mock-tab-explorer')).not.toBeInTheDocument();
  expect(screen.getByTestId('mock-database-selector-popover')).toHaveAttribute(
    'data-compact',
    'true',
  );
});
