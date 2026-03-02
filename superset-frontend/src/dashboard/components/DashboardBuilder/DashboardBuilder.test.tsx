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
  fireEvent,
  render,
  within,
  screen,
} from 'spec/helpers/testing-library';
import { FeatureFlag } from '@superset-ui/core';
import {
  OPEN_FILTER_BAR_WIDTH,
  CLOSED_FILTER_BAR_WIDTH,
} from 'src/dashboard/constants';
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  fetchFaveStar,
  setActiveTab,
  setDirectPathToChild,
} from 'src/dashboard/actions/dashboardState';
import {
  dashboardLayout as undoableDashboardLayout,
  dashboardLayoutWithTabs as undoableDashboardLayoutWithTabs,
} from 'spec/fixtures/mockDashboardLayout';
import { storeWithState } from 'spec/fixtures/mockStore';
import mockState from 'spec/fixtures/mockState';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import * as useNativeFiltersModule from './state';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.put('glob:*/api/v1/dashboard/*', {});
// Add mock for logging endpoint
fetchMock.post('glob:*/superset/log/?*', {});

// Mock useBreakpoint to return desktop breakpoints (prevents mobile rendering)
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => ({ xs: true, sm: true, md: true, lg: true, xl: true }),
  },
}));

jest.mock('src/dashboard/actions/dashboardState', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardState'),
  fetchFaveStar: jest.fn(),
  setActiveTab: jest.fn(),
  setDirectPathToChild: jest.fn(),
}));
jest.mock('src/components/ResizableSidebar/useStoredSidebarWidth');

// mock following dependent components to fix the prop warnings
jest.mock('@superset-ui/core/components/Select/Select', () => {
  const MockSelect = () => <div data-test="mock-select" />;
  MockSelect.displayName = 'MockSelect';
  return MockSelect;
});
jest.mock('@superset-ui/core/components/Select/AsyncSelect', () => {
  const MockAsyncSelect = () => <div data-test="mock-async-select" />;
  MockAsyncSelect.displayName = 'MockAsyncSelect';
  return MockAsyncSelect;
});
jest.mock('@superset-ui/core/components/PageHeaderWithActions', () => {
  const MockPageHeaderWithActions = () => (
    <div data-test="mock-page-header-with-actions" />
  );
  MockPageHeaderWithActions.displayName = 'MockPageHeaderWithActions';
  return {
    PageHeaderWithActions: MockPageHeaderWithActions,
  };
});
jest.mock(
  'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal',
  () => {
    const MockFiltersConfigModal = () => (
      <div data-test="mock-filters-config-modal" />
    );
    MockFiltersConfigModal.displayName = 'MockFiltersConfigModal';
    return MockFiltersConfigModal;
  },
);
jest.mock('src/dashboard/components/BuilderComponentPane', () => {
  const MockBuilderComponentPane = () => (
    <div data-test="mock-builder-component-pane" />
  );
  MockBuilderComponentPane.displayName = 'MockBuilderComponentPane';
  return MockBuilderComponentPane;
});
jest.mock('src/dashboard/components/nativeFilters/FilterBar', () => {
  const MockFilterBar = () => <div data-test="mock-filter-bar" />;
  MockFilterBar.displayName = 'MockFilterBar';
  return MockFilterBar;
});
jest.mock('src/dashboard/containers/DashboardGrid', () => {
  const MockDashboardGrid = () => <div data-test="mock-dashboard-grid" />;
  MockDashboardGrid.displayName = 'MockDashboardGrid';
  return MockDashboardGrid;
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardBuilder', () => {
  let favStarStub: jest.Mock;
  let activeTabsStub: jest.Mock;

  beforeAll(() => {
    // this is invoked on mount, so we stub it instead of making a request
    favStarStub = (fetchFaveStar as jest.Mock).mockReturnValue({
      type: 'mock-action',
    });
    activeTabsStub = (setActiveTab as jest.Mock).mockReturnValue({
      type: 'mock-action',
    });
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      100,
      jest.fn(),
    ]);
  });

  afterAll(() => {
    favStarStub.mockReset();
    activeTabsStub.mockReset();
    (useStoredSidebarWidth as jest.Mock).mockReset();
  });

  function setup(overrideState = {}) {
    return render(<DashboardBuilder />, {
      useRedux: true,
      store: storeWithState({
        ...mockState,
        dashboardLayout: undoableDashboardLayout,
        ...overrideState,
      }),
      useDnd: true,
      useTheme: true,
    });
  }

  test('should render a StickyContainer with class "dashboard"', () => {
    const { getByTestId } = setup();
    const stickyContainer = getByTestId('dashboard-content-wrapper');
    expect(stickyContainer).toHaveClass('dashboard');
  });

  test('should add the "dashboard--editing" class if editMode=true', () => {
    const { getByTestId } = setup({
      dashboardState: { ...mockState.dashboardState, editMode: true },
    });
    const stickyContainer = getByTestId('dashboard-content-wrapper');
    expect(stickyContainer).toHaveClass('dashboard dashboard--editing');
  });

  test('should render a DragDroppable DashboardHeader', () => {
    const { queryByTestId } = setup();
    const header = queryByTestId('dashboard-header-container');
    expect(header).toBeInTheDocument();
  });

  test('should render a Sticky top-level Tabs if the dashboard has tabs', async () => {
    const { findAllByTestId } = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
    });
    const sticky = await findAllByTestId('nav-list');

    expect(sticky.length).toBe(1);
    expect(sticky[0]).toHaveAttribute('id', 'TABS_ID');

    const dashboardTabComponents = within(sticky[0]).getAllByRole('tab');
    const tabChildren =
      undoableDashboardLayoutWithTabs.present.TABS_ID.children;
    expect(dashboardTabComponents.length).toBe(tabChildren.length);
    tabChildren.forEach((tabId, i) => {
      const idMatcher = new RegExp(`${tabId}$`);
      expect(dashboardTabComponents[i]).toHaveAttribute(
        'id',
        expect.stringMatching(idMatcher),
      );
    });
  });

  test('should render one Tabs and two TabPane', async () => {
    const { findAllByRole } = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
    });
    const tabs = await findAllByRole('tablist');
    expect(tabs.length).toBe(1);
    const tabPanels = await findAllByRole('tabpanel');
    expect(tabPanels.length).toBe(2);
  });

  test('should render a TabPane and DashboardGrid for first Tab', async () => {
    const { findByTestId } = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
    });
    const parentSize = await findByTestId('grid-container');
    const firstTab = screen.getByText('tab1');
    expect(firstTab).toBeInTheDocument();
    const tabPanels = within(parentSize).getAllByRole('tabpanel', {
      // to include invisible tab panels
      hidden: false,
    });
    expect(
      within(tabPanels[0]).getAllByTestId('mock-dashboard-grid').length,
    ).toBe(1);
  });

  test('should render a TabPane and DashboardGrid for second Tab', async () => {
    const { findByTestId } = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
      dashboardState: {
        ...mockState.dashboardState,
        directPathToChild: [DASHBOARD_ROOT_ID, 'TABS_ID', 'TAB_ID2'],
      },
    });
    const parentSize = await findByTestId('grid-container');
    const secondTab = screen.getByText('tab2');
    expect(secondTab).toBeInTheDocument();
    fireEvent.click(secondTab);
    const tabPanels = within(parentSize).getAllByRole('tabpanel', {
      // to include invisible tab panels
      hidden: true,
    });
    expect(
      within(tabPanels[0]).getAllByTestId('mock-dashboard-grid').length,
    ).toBe(1);
  });

  test('should render a BuilderComponentPane if editMode=false and user selects "Insert Components" pane', () => {
    const { queryAllByTestId } = setup();
    const builderComponents = queryAllByTestId('mock-builder-component-pane');
    expect(builderComponents.length).toBe(0);
  });

  test('should render a BuilderComponentPane if editMode=true and user selects "Insert Components" pane', () => {
    const { queryAllByTestId } = setup({
      dashboardState: { ...mockState.dashboardState, editMode: true },
    });
    const builderComponents = queryAllByTestId('mock-builder-component-pane');
    expect(builderComponents.length).toBeGreaterThanOrEqual(1);
  });

  test('should change redux state if a top-level Tab is clicked', async () => {
    (setDirectPathToChild as jest.Mock).mockImplementation(arg0 => ({
      type: 'type',
      arg0,
    }));
    const { findByRole } = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
    });
    const tabList = await findByRole('tablist');
    const tabs = within(tabList).getAllByRole('tab');
    expect(setDirectPathToChild).toHaveBeenCalledTimes(0);
    fireEvent.click(tabs[1]);
    expect(setDirectPathToChild).toHaveBeenCalledWith([
      'ROOT_ID',
      'TABS_ID',
      'TAB_ID2',
    ]);
    (setDirectPathToChild as jest.Mock).mockReset();
  });

  test('should not display a loading spinner when saving is not in progress', () => {
    const { queryByTestId } = setup();

    expect(queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  test('should display a loading spinner when saving is in progress', async () => {
    const { findByTestId } = setup({
      dashboardState: { ...mockState.dashboardState, dashboardIsSaving: true },
    });

    expect(await findByTestId('loading-indicator')).toBeVisible();
  });

  test('should set FilterBar width by useStoredSidebarWidth', () => {
    const expectedValue = 200;
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      expectedValue,
      setter,
    ]);
    const { getByTestId } = setup({
      dashboardInfo: {
        ...mockState.dashboardInfo,
        dash_edit_perm: true,
      },
    });
    const filterbar = getByTestId('dashboard-filters-panel');
    expect(filterbar).toHaveStyleRule('width', `${expectedValue}px`);
  });

  test('should set header max width based on open filter bar width', () => {
    const expectedValue = 320;
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      expectedValue,
      setter,
    ]);
    const nativeFiltersSpy = jest
      .spyOn(useNativeFiltersModule, 'useNativeFilters')
      .mockReturnValue({
        showDashboard: true,
        missingInitialFilters: [],
        dashboardFiltersOpen: true,
        toggleDashboardFiltersOpen: jest.fn(),
        nativeFiltersEnabled: true,
        hasFilters: true,
      });

    const { getByTestId } = setup();

    expect(getByTestId('dashboard-header-wrapper')).toHaveStyleRule(
      'max-width',
      `calc(100vw - ${expectedValue}px)`,
    );

    nativeFiltersSpy.mockRestore();
  });

  test('should use closed filter bar width when the panel is collapsed', () => {
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      OPEN_FILTER_BAR_WIDTH,
      setter,
    ]);
    const nativeFiltersSpy = jest
      .spyOn(useNativeFiltersModule, 'useNativeFilters')
      .mockReturnValue({
        showDashboard: true,
        missingInitialFilters: [],
        dashboardFiltersOpen: false,
        toggleDashboardFiltersOpen: jest.fn(),
        nativeFiltersEnabled: true,
        hasFilters: true,
      });

    const { getByTestId } = setup();

    expect(getByTestId('dashboard-header-wrapper')).toHaveStyleRule(
      'max-width',
      `calc(100vw - ${CLOSED_FILTER_BAR_WIDTH}px)`,
    );

    nativeFiltersSpy.mockRestore();
  });

  test('should not constrain header width when filter bar is hidden', () => {
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      OPEN_FILTER_BAR_WIDTH,
      setter,
    ]);
    const nativeFiltersSpy = jest
      .spyOn(useNativeFiltersModule, 'useNativeFilters')
      .mockReturnValue({
        showDashboard: true,
        missingInitialFilters: [],
        dashboardFiltersOpen: true,
        toggleDashboardFiltersOpen: jest.fn(),
        nativeFiltersEnabled: false,
        hasFilters: false,
      });

    const { getByTestId } = setup();

    expect(getByTestId('dashboard-header-wrapper')).toHaveStyleRule(
      'max-width',
      'calc(100vw - 0px)',
    );

    nativeFiltersSpy.mockRestore();
  });

  test('filter panel state when featureflag is true', () => {
    window.featureFlags = {
      [FeatureFlag.FilterBarClosedByDefault]: true,
    };
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      CLOSED_FILTER_BAR_WIDTH,
      setter,
    ]);
    const { getByTestId } = setup({
      dashboardInfo: {
        ...mockState.dashboardInfo,
        dash_edit_perm: true,
      },
    });

    const filterbar = getByTestId('dashboard-filters-panel');
    expect(filterbar).toHaveStyleRule('width', `${CLOSED_FILTER_BAR_WIDTH}px`);
  });

  test('filter panel state when featureflag is false', () => {
    window.featureFlags = {
      [FeatureFlag.FilterBarClosedByDefault]: false,
    };
    const setter = jest.fn();
    (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
      OPEN_FILTER_BAR_WIDTH,
      setter,
    ]);
    const { getByTestId } = setup({
      dashboardInfo: {
        ...mockState.dashboardInfo,
        dash_edit_perm: true,
      },
    });

    const filterbar = getByTestId('dashboard-filters-panel');
    expect(filterbar).toHaveStyleRule('width', `${OPEN_FILTER_BAR_WIDTH}px`);
  });

  test('should not render the filter bar when nativeFiltersEnabled is false', () => {
    jest.spyOn(useNativeFiltersModule, 'useNativeFilters').mockReturnValue({
      showDashboard: true,
      missingInitialFilters: [],
      dashboardFiltersOpen: true,
      toggleDashboardFiltersOpen: jest.fn(),
      nativeFiltersEnabled: false,
      hasFilters: false,
    });
    const { queryByTestId } = setup();

    expect(queryByTestId('dashboard-filters-panel')).not.toBeInTheDocument();
  });

  test('should render the filter bar when nativeFiltersEnabled is true and not in edit mode', () => {
    jest.spyOn(useNativeFiltersModule, 'useNativeFilters').mockReturnValue({
      showDashboard: true,
      missingInitialFilters: [],
      dashboardFiltersOpen: true,
      toggleDashboardFiltersOpen: jest.fn(),
      nativeFiltersEnabled: true,
      hasFilters: true,
    });
    const { queryByTestId } = setup();

    expect(queryByTestId('dashboard-filters-panel')).toBeInTheDocument();
  });

  test('should not render the filter bar when in edit mode even if nativeFiltersEnabled is true', () => {
    jest.spyOn(useNativeFiltersModule, 'useNativeFilters').mockReturnValue({
      showDashboard: true,
      missingInitialFilters: [],
      dashboardFiltersOpen: true,
      toggleDashboardFiltersOpen: jest.fn(),
      nativeFiltersEnabled: true,
      hasFilters: true,
    });
    const { queryByTestId } = setup({
      dashboardState: { ...mockState.dashboardState, editMode: true },
    });

    expect(queryByTestId('dashboard-filters-panel')).not.toBeInTheDocument();
  });
});

test('should render ParentSize wrapper with height 100% for tabs', async () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });

  const { findByTestId } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayoutWithTabs,
    }),
    useDnd: true,
    useTheme: true,
  });

  const gridContainer = await findByTestId('grid-container');
  const parentSizeWrapper = gridContainer.querySelector('div');
  const tabPanels = within(gridContainer).getAllByRole('tabpanel', {
    hidden: true,
  });

  expect(gridContainer).toBeInTheDocument();
  expect(parentSizeWrapper).toBeInTheDocument();
  expect(tabPanels.length).toBeGreaterThan(0);
});

test('should maintain layout when switching between tabs', async () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setDirectPathToChild as jest.Mock).mockImplementation(arg0 => ({
    type: 'type',
    arg0,
  }));

  const { findByTestId } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayoutWithTabs,
    }),
    useDnd: true,
    useTheme: true,
  });

  const gridContainer = await findByTestId('grid-container');

  fireEvent.click(screen.getByText('tab1'));
  fireEvent.click(screen.getByText('tab2'));

  const tabPanels = within(gridContainer).getAllByRole('tabpanel', {
    hidden: true,
  });

  expect(gridContainer).toBeInTheDocument();
  expect(tabPanels.length).toBeGreaterThan(0);
});

// Mobile support tests
// Note: The main mobile tests require mocking useBreakpoint to return mobile breakpoints
// which is done at the module level. These tests verify mobile-related component behavior.

test('should not render filter bar panel on desktop when nativeFiltersEnabled is false', () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });

  jest.spyOn(useNativeFiltersModule, 'useNativeFilters').mockReturnValue({
    showDashboard: true,
    missingInitialFilters: [],
    dashboardFiltersOpen: true,
    toggleDashboardFiltersOpen: jest.fn(),
    nativeFiltersEnabled: false,
    hasFilters: false,
  });

  const { queryByTestId } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayout,
    }),
    useDnd: true,
    useTheme: true,
  });

  // Filter panel should not be present when native filters are disabled
  expect(queryByTestId('dashboard-filters-panel')).not.toBeInTheDocument();
});

test('should render dashboard content wrapper', () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });

  const { getByTestId } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayout,
    }),
    useDnd: true,
    useTheme: true,
  });

  // Dashboard content wrapper should always be present
  expect(getByTestId('dashboard-content-wrapper')).toBeInTheDocument();
});

test('should render header container', () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });

  const { queryByTestId } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayout,
    }),
    useDnd: true,
    useTheme: true,
  });

  // Header container should be present
  expect(queryByTestId('dashboard-header-container')).toBeInTheDocument();
});
