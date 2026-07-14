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
import { addAlpha, FeatureFlag } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
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
fetchMock.post('glob:*/log/?*', {});

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
// The real component renders null, so mock it with a visible marker to let
// tests assert whether DashboardBuilder mounts it.
jest.mock('src/dashboard/components/Header/HeadlessAutoRefresh', () => {
  const MockHeadlessAutoRefresh = () => (
    <div data-test="mock-headless-auto-refresh" />
  );
  MockHeadlessAutoRefresh.displayName = 'MockHeadlessAutoRefresh';
  return MockHeadlessAutoRefresh;
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
      useRouter: true,
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

  test('should hide DashboardHeader when standalone mode hides nav and title (?standalone=2)', () => {
    // React-level equivalent of the legacy `cy.get('#app-menu').should('not.exist')`
    // Cypress assertion. The `#app-menu` node lives in Flask's spa.html template,
    // gated by `{% if standalone_mode %}`, so RTL cannot reach it directly.
    // `?standalone=2` maps to DashboardStandaloneMode.HideNavAndTitle, which the
    // DashboardBuilder honours by suppressing the React-side DashboardHeader.
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/?standalone=2');
    try {
      const { queryByTestId } = setup();
      expect(
        queryByTestId('dashboard-header-container'),
      ).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
  });

  test('should mount HeadlessAutoRefresh when the header is hidden (?standalone=2)', () => {
    // Regression test for #25970: the auto-refresh timer lives in the header,
    // so hiding the header must swap in the headless driver — reverting the
    // conditional in DashboardBuilder would strand standalone dashboards with
    // no refresh timer at all.
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/?standalone=2');
    try {
      const { queryByTestId } = setup();
      expect(queryByTestId('mock-headless-auto-refresh')).toBeInTheDocument();
      expect(
        queryByTestId('dashboard-header-container'),
      ).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
  });

  test('should not mount HeadlessAutoRefresh when the header is visible', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('dashboard-header-container')).toBeInTheDocument();
    expect(queryByTestId('mock-headless-auto-refresh')).not.toBeInTheDocument();
  });

  test('should not start any auto-refresh in report mode (?standalone=3)', () => {
    // Report mode drives one-shot screenshot renders (email reports,
    // thumbnails); a live refresh timer there could re-fetch charts
    // mid-capture, so neither the header nor the headless driver may mount.
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/?standalone=3');
    try {
      const { queryByTestId } = setup();
      expect(
        queryByTestId('dashboard-header-container'),
      ).not.toBeInTheDocument();
      expect(
        queryByTestId('mock-headless-auto-refresh'),
      ).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
  });

  test('should keep the DashboardHeader when standalone mode only hides nav (?standalone=1)', () => {
    // `?standalone=1` maps to DashboardStandaloneMode.HideNav, which only hides the
    // Flask-rendered global app menu (#app-menu) — it must NOT suppress the React-side
    // DashboardHeader. This pins the boundary against HideNavAndTitle (?standalone=2).
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/?standalone=1');
    try {
      const { queryByTestId } = setup();
      expect(queryByTestId('dashboard-header-container')).toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
  });

  test('should keep the header hidden in standalone mode (?standalone=2) while editMode is active', () => {
    // Orthogonality analogue of the legacy `?edit=true&standalone=true` Cypress mount.
    // editMode is sourced from Redux (state.dashboardState.editMode), not the URL —
    // DashboardBuilder only reads URL_PARAMS.standalone — so the legacy `edit=true`
    // param is inert here and is intentionally omitted. Contract under test:
    // standalone=2 (HideNavAndTitle) suppresses DashboardHeader even while editMode
    // drives the `dashboard--editing` class on the wrapper.
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/?standalone=2');
    try {
      const { getByTestId, queryByTestId } = setup({
        dashboardState: { ...mockState.dashboardState, editMode: true },
      });
      expect(getByTestId('dashboard-content-wrapper')).toHaveClass(
        'dashboard dashboard--editing',
      );
      expect(
        queryByTestId('dashboard-header-container'),
      ).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
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
    useRouter: true,
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

test('should apply min-height to the top-level tab drop target so tabs can be dropped on dashboards with content', () => {
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
      dashboardState: { ...mockState.dashboardState, editMode: true },
    }),
    useDnd: true,
    useTheme: true,
    useRouter: true,
  });

  const headerWrapper = getByTestId('dashboard-header-wrapper');

  // The Droppable inside the header should have the empty-droptarget class
  // when there are no top-level tabs and edit mode is active. Without this
  // class (and its associated min-height CSS rule), the drop target has zero
  // height and users cannot drag tabs onto dashboards that already have
  // content.
  const droptarget = headerWrapper.querySelector('.empty-droptarget');
  expect(droptarget).toBeInTheDocument();

  // Verify the StyledHeader CSS defines a non-zero min-height for
  // .empty-droptarget, derived from theme.sizeUnit * 4 to stay in sync
  // with the source rule in DashboardBuilder.tsx.
  expect(headerWrapper).toHaveStyleRule(
    'min-height',
    `${supersetTheme.sizeUnit * 4}px`,
    {
      target: '.empty-droptarget',
    },
  );
});

test('should render chart tiles with a theme-driven border at rest, see https://github.com/apache/superset/issues/41618', () => {
  (useStoredSidebarWidth as jest.Mock).mockImplementation(() => [
    100,
    jest.fn(),
  ]);
  (fetchFaveStar as jest.Mock).mockReturnValue({ type: 'mock-action' });
  (setActiveTab as jest.Mock).mockReturnValue({ type: 'mock-action' });

  const { container } = render(<DashboardBuilder />, {
    useRedux: true,
    store: storeWithState({
      ...mockState,
      dashboardLayout: undoableDashboardLayout,
    }),
    useDnd: true,
    useTheme: true,
    useRouter: true,
  });

  // StyledDashboardContent (className "dashboard-content") owns the nested
  // `.dashboard-component-chart-holder` CSS, so it's the element to assert
  // style rules against, not the individual chart holder nodes it renders.
  const dashboardContent = container.querySelector('.dashboard-content');

  expect(dashboardContent).toHaveStyleRule(
    'border',
    `1px solid ${supersetTheme.colorBorder}`,
    { target: '.dashboard-component-chart-holder' },
  );
  expect(dashboardContent).toHaveStyleRule(
    'border-radius',
    `${supersetTheme.borderRadius}px`,
    { target: '.dashboard-component-chart-holder' },
  );

  // .fade-out no longer re-declares border/border-radius (it inherits the
  // base rule above); it should still layer its own hairline box-shadow.
  expect(dashboardContent).toHaveStyleRule(
    'box-shadow',
    `0 0 0 1px ${addAlpha(supersetTheme.colorBorder, 0.5)}`,
    { target: '.dashboard-component-chart-holder.fade-out' },
  );
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
    useRouter: true,
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
