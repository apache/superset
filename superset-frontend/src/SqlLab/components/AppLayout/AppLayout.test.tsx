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
import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { initialState } from 'src/SqlLab/fixtures';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import { ViewLocations } from 'src/SqlLab/contributions';
import * as sqlLabActions from 'src/SqlLab/actions/sqlLab';
import { Disposable } from 'src/core';
import { resetLeftBarViews } from 'src/SqlLab/components/SqlEditorLeftBar/builtins';
import { resetLeftBarLayoutState } from 'src/SqlLab/hooks/useLeftBarLayout';
import { resetLeftBarViewSettings } from 'src/SqlLab/hooks/useLeftBarViewSettings';
import {
  registerTestView,
  registerTestViewContainer,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';
import AppLayout from './index';

const noopIcon = () => null;

/** Registers a rail container plus its content view, tracked for cleanup. */
const registerLeftBarView = (
  id: string,
  name: string,
  panel: () => React.ReactElement | null = () => null,
) =>
  Disposable.from(
    registerTestViewContainer(
      ViewLocations.sqllab.leftSidebar,
      id,
      name,
      noopIcon,
    ),
    registerTestView(id, id, name, panel),
  );

jest.mock('src/components/ResizableSidebar/useStoredSidebarWidth');
jest.mock('src/components/Splitter', () => {
  const Splitter = ({
    onResizeEnd,
    children,
  }: {
    onResizeEnd: (sizes: number[]) => void;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onResizeEnd([500])}>
        Resize
      </button>
      <button type="button" onClick={() => onResizeEnd([0])}>
        Resize to zero
      </button>
    </div>
  );
  // eslint-disable-next-line react/display-name
  Splitter.Panel = ({ children }: { children: React.ReactNode }) => (
    <div data-test="mock-panel">{children}</div>
  );
  return { Splitter };
});
jest.mock('@superset-ui/core/components/Grid', () => ({
  ...jest.requireActual('@superset-ui/core/components/Grid'),
  useBreakpoint: jest.fn().mockReturnValue(true),
}));

const defaultProps = {
  children: <div>Child</div>,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, jest.fn()]);
  resetLeftBarViews();
  resetLeftBarLayoutState();
  resetLeftBarViewSettings();
});

afterEach(cleanupExtensions);

test('renders two panels', () => {
  const { getAllByTestId } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  expect(getAllByTestId('mock-panel')).toHaveLength(2);
});

test('renders children', () => {
  const { getByText } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  expect(getByText('Child')).toBeInTheDocument();
});

test('calls setWidth on sidebar resize when not hidden', async () => {
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, setWidth]);
  const { getByRole } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });

  // toggle sidebar to show
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  // set different width
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  await waitFor(() => expect(setWidth).toHaveBeenCalled());
});

test('right sidebar is hidden when no extensions registered', () => {
  const { queryByText } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  // No right sidebar content — the third Splitter.Panel is conditionally omitted
  expect(queryByText('Right Sidebar Content')).not.toBeInTheDocument();
});

test('dispatches toggleLeftBar(true) when sidebar is resized to zero', async () => {
  const toggleLeftBarSpy = jest
    .spyOn(sqlLabActions, 'toggleLeftBar')
    .mockReturnValue({
      type: sqlLabActions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
    } as any);
  const { getByRole } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  await userEvent.click(getByRole('button', { name: 'Resize to zero' }));
  await waitFor(() => expect(toggleLeftBarSpy).toHaveBeenCalledWith(true));
  toggleLeftBarSpy.mockRestore();
});

test('dispatches toggleLeftBar(false) when sidebar is resized to non-zero', async () => {
  const collapsedState = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: initialState.sqlLab.tabHistory[0],
        hideLeftBar: true,
      },
    },
  };
  const toggleLeftBarSpy = jest
    .spyOn(sqlLabActions, 'toggleLeftBar')
    .mockReturnValue({
      type: sqlLabActions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
    } as any);
  const { getByRole } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState: collapsedState,
  });
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  await waitFor(() => expect(toggleLeftBarSpy).toHaveBeenCalledWith(false));
  toggleLeftBarSpy.mockRestore();
});

test('renders right sidebar when view is contributed at rightSidebar location', () => {
  registerTestView(
    ViewLocations.sqllab.rightSidebar,
    'test-right-sidebar-view',
    'Test Right Sidebar View',
    () => React.createElement('div', null, 'Right Sidebar Content'),
  );

  const { getByText, getAllByTestId } = render(
    <AppLayout {...defaultProps} />,
    {
      useRedux: true,
      initialState,
    },
  );

  expect(getByText('Child')).toBeInTheDocument();
  expect(getByText('Right Sidebar Content')).toBeInTheDocument();
  expect(getAllByTestId('mock-panel')).toHaveLength(3);
});

test('an unrelated resize-end reporting zero while rail-collapsed does not clobber the stored width', async () => {
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, setWidth]);
  const toggleLeftBarSpy = jest
    .spyOn(sqlLabActions, 'toggleLeftBar')
    .mockReturnValue({
      type: sqlLabActions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
    } as any);
  const disposable = registerLeftBarView('ext.a', 'Ext A');

  const { getByRole, getByTitle } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  // jsdom's real (unmocked) breakpoint observer settles shortly after mount,
  // which can trigger the unrelated small-screen auto-hide once; clear that
  // so the assertions below are only about our own interactions.
  setWidth.mockClear();
  toggleLeftBarSpy.mockClear();

  // Collapse the rail's content panel (Explorer is the default active item).
  await userEvent.click(getByTitle('Explorer'));
  // This panel is already rendered at 0 while rail-collapsed, so a stray
  // resize-end elsewhere (e.g. dragging the *right* sidebar) still reports
  // 0 for it too — that must not persist as the stored expanded width.
  await userEvent.click(getByRole('button', { name: 'Resize to zero' }));

  expect(setWidth).not.toHaveBeenCalled();
  expect(toggleLeftBarSpy).not.toHaveBeenCalled();

  toggleLeftBarSpy.mockRestore();
  disposable.dispose();
});

test('a resize-end reporting a nonzero size while rail-collapsed restores the width and clears the collapse flag', async () => {
  // This is what the Splitter's own collapsible icon produces when clicked
  // from the rail-collapsed state — honored as a deliberate reopen, unlike
  // the zero-size case above.
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, setWidth]);
  const toggleLeftBarSpy = jest
    .spyOn(sqlLabActions, 'toggleLeftBar')
    .mockReturnValue({
      type: sqlLabActions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
    } as any);
  const disposable = registerLeftBarView('ext.a', 'Ext A');

  const { getByRole, getByTitle } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  setWidth.mockClear();
  toggleLeftBarSpy.mockClear();

  await userEvent.click(getByTitle('Explorer')); // collapse via the rail
  await userEvent.click(getByRole('button', { name: 'Resize' }));

  expect(setWidth).toHaveBeenCalledWith(500);
  expect(toggleLeftBarSpy).toHaveBeenCalledWith(false);

  toggleLeftBarSpy.mockRestore();
  disposable.dispose();
});

test('renders one rail item per registered view, Explorer first, Settings pinned in its own bottom menu', () => {
  const disposableA = registerLeftBarView('ext.a', 'Ext A');
  const disposableB = registerLeftBarView('ext.b', 'Ext B');

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });

  const menus = screen.getAllByRole('menu');
  expect(menus).toHaveLength(2);
  const [mainMenu, settingsMenu] = menus;
  expect(mainMenu.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
  expect(settingsMenu.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
  expect(screen.getByTitle('Explorer')).toBeInTheDocument();
  expect(screen.getByTitle('Ext A')).toBeInTheDocument();
  expect(screen.getByTitle('Ext B')).toBeInTheDocument();
  expect(screen.getByTitle('Settings')).toBeInTheDocument();
  expect(mainMenu).not.toContainElement(screen.getByTitle('Settings'));
  expect(settingsMenu).toContainElement(screen.getByTitle('Settings'));

  disposableA.dispose();
  disposableB.dispose();
});

test('clicking a rail icon swaps the active panel content', async () => {
  const disposable = registerLeftBarView('ext.a', 'Ext A', () => (
    <div>Ext A panel</div>
  ));

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });
  await userEvent.click(screen.getByTitle('Ext A'));

  expect(screen.getByText('Ext A panel')).toBeInTheDocument();

  disposable.dispose();
});

test('clicking the active rail icon again re-expands the content it collapsed, without resetting its state', async () => {
  // The content panel stays mounted through a collapse/re-expand cycle — the
  // actual visual hiding happens via the real Splitter shrinking to zero
  // width, not by unmounting. Unmounting on collapse would remount (and
  // reset) the panel's internal state every time the user re-expands it.
  const StatefulPanel = () => {
    const [count, setCount] = React.useState(0);
    return (
      <button type="button" onClick={() => setCount(c => c + 1)}>
        count: {count}
      </button>
    );
  };
  const disposable = registerLeftBarView('ext.a', 'Ext A', StatefulPanel);

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });
  await userEvent.click(screen.getByTitle('Ext A'));
  await userEvent.click(screen.getByRole('button', { name: /count: 0/ }));
  expect(screen.getByRole('button', { name: /count: 1/ })).toBeInTheDocument();

  await userEvent.click(screen.getByTitle('Ext A')); // collapse
  // The rail itself is unaffected by the content being collapsed.
  expect(screen.getByTitle('Explorer')).toBeInTheDocument();
  expect(screen.getByTitle('Ext A')).toBeInTheDocument();

  await userEvent.click(screen.getByTitle('Ext A')); // re-expand
  expect(screen.getByRole('button', { name: /count: 1/ })).toBeInTheDocument();

  disposable.dispose();
});

test('clicking a different rail icon while collapsed expands and switches', async () => {
  const disposable = registerLeftBarView('ext.a', 'Ext A', () => (
    <div>Ext A panel</div>
  ));

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });
  await userEvent.click(screen.getByTitle('Explorer')); // collapse

  await userEvent.click(screen.getByTitle('Ext A'));
  expect(screen.getByText('Ext A panel')).toBeInTheDocument();

  disposable.dispose();
});

test('a crashing panel does not take down the rail', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  const Crashing = () => {
    throw new Error('boom');
  };
  const disposable = registerLeftBarView('ext.crash', 'Crash', Crashing);

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });
  await userEvent.click(screen.getByTitle('Crash'));

  expect(
    screen.getByTestId('left-bar-panel-slot-ext.crash'),
  ).toBeInTheDocument();
  expect(screen.getByTitle('Explorer')).toBeInTheDocument();
  expect(screen.getByTitle('Crash')).toBeInTheDocument();

  await userEvent.click(screen.getByTitle('Explorer'));
  expect(screen.getByTestId('sql-editor-left-bar')).toBeInTheDocument();

  consoleErrorSpy.mockRestore();
  disposable.dispose();
});

test('the rail stays mounted regardless of the content Splitter panel being collapsed', async () => {
  const disposable = registerLeftBarView('ext.a', 'Ext A');

  const { getByRole } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });

  // Drag-collapse the content Splitter panel fully (the pre-existing
  // hideLeftBar mechanism) rather than using the rail's own toggle.
  await userEvent.click(getByRole('button', { name: 'Resize to zero' }));

  // The rail is a sibling of the Splitter, not a child inside it, so it's
  // unaffected by the Splitter panel itself being hidden.
  expect(screen.getByTitle('Explorer')).toBeInTheDocument();
  expect(screen.getByTitle('Ext A')).toBeInTheDocument();
  expect(screen.getByTitle('Settings')).toBeInTheDocument();

  disposable.dispose();
});

test('clicking a rail icon restores the sidebar after the Splitter itself hid it to zero width', async () => {
  // Once the Splitter's own drag/collapsible-icon has driven leftWidth to 0,
  // contentCollapsed is already false — toggling it again would be a no-op,
  // since size stays 0 regardless. The rail click must restore the stored
  // width directly instead.
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([0, setWidth]);
  const toggleLeftBarSpy = jest
    .spyOn(sqlLabActions, 'toggleLeftBar')
    .mockReturnValue({
      type: sqlLabActions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
    } as any);
  const disposable = registerLeftBarView('ext.a', 'Ext A');

  render(<AppLayout {...defaultProps} />, { useRedux: true, initialState });
  await userEvent.click(screen.getByTitle('Explorer'));

  expect(setWidth).toHaveBeenCalledWith(SQL_EDITOR_LEFTBAR_WIDTH);
  expect(toggleLeftBarSpy).toHaveBeenCalledWith(false);

  toggleLeftBarSpy.mockRestore();
  disposable.dispose();
});
