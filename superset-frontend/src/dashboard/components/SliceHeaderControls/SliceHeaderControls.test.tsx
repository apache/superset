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

import { KeyboardEvent, ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { FeatureFlag } from '@superset-ui/core';
import mockState from 'spec/fixtures/mockState';
import { Menu } from 'src/components/Menu';
import SliceHeaderControls, {
  SliceHeaderControlsProps,
  handleDropdownNavigation,
} from '.';

jest.mock('src/components/Dropdown', () => {
  const original = jest.requireActual('src/components/Dropdown');
  return {
    ...original,
    NoAnimationDropdown: (props: any) => (
      <div data-test="NoAnimationDropdown" className="ant-dropdown">
        {props.overlay}
        {props.children}
      </div>
    ),
  };
});

const createProps = (viz_type = 'sunburst_v2') =>
  ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    exploreChart: jest.fn(),
    exportCSV: jest.fn(),
    exportFullCSV: jest.fn(),
    exportXLSX: jest.fn(),
    exportFullXLSX: jest.fn(),
    forceRefresh: jest.fn(),
    handleToggleFullSize: jest.fn(),
    toggleExpandSlice: jest.fn(),
    logEvent: jest.fn(),
    slice: {
      slice_id: 371,
      slice_url: '/explore/?form_data=%7B%22slice_id%22%3A%20371%7D',
      slice_name: 'Vaccine Candidates per Country & Stage',
      slice_description: 'Table of vaccine candidates for 100 countries',
      form_data: {
        adhoc_filters: [],
        color_scheme: 'supersetColors',
        datasource: '58__table',
        ...(viz_type === 'sunburst_v2'
          ? { columns: ['product_category', 'clinical_stage'] }
          : { groupby: ['product_category', 'clinical_stage'] }),
        linear_color_scheme: 'schemeYlOrBr',
        metric: 'count',
        queryFields: {
          groupby: 'groupby',
          metric: 'metrics',
          secondary_metric: 'metrics',
        },
        row_limit: 10000,
        slice_id: 371,
        time_range: 'No filter',
        url_params: {},
        viz_type,
      },
      viz_type,
      datasource: '58__table',
      description: 'test-description',
      description_markeddown: '',
      owners: [],
      modified: '<span class="no-wrap">22 hours ago</span>',
      changed_on: 1617143411523,
    },
    isCached: [false],
    isExpanded: false,
    cachedDttm: [''],
    updatedDttm: 1617213803803,
    supersetCanExplore: true,
    supersetCanCSV: true,
    componentId: 'CHART-fYo7IyvKZQ',
    dashboardId: 26,
    isFullSize: false,
    chartStatus: 'rendered',
    showControls: true,
    supersetCanShare: true,
    formData: { slice_id: 1, datasource: '58__table', viz_type: 'sunburst_v2' },
    exploreUrl: '/explore',
  }) as SliceHeaderControlsProps;

const renderWrapper = (
  overrideProps?: SliceHeaderControlsProps,
  roles?: Record<string, string[][]>,
) => {
  const props = overrideProps || createProps();
  return render(<SliceHeaderControls {...props} />, {
    useRedux: true,
    useRouter: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: roles ?? {
          Admin: [['can_samples', 'Datasource']],
        },
      },
    },
  });
};

test('Should render', () => {
  renderWrapper();
  expect(
    screen.getByRole('button', { name: 'More Options' }),
  ).toBeInTheDocument();
  expect(screen.getByTestId('NoAnimationDropdown')).toBeInTheDocument();
});

test('Should render default props', () => {
  const props = createProps();

  // @ts-ignore
  delete props.forceRefresh;
  // @ts-ignore
  delete props.toggleExpandSlice;
  // @ts-ignore
  delete props.exploreChart;
  // @ts-ignore
  delete props.exportCSV;
  // @ts-ignore
  delete props.exportXLSX;
  // @ts-ignore
  delete props.cachedDttm;
  // @ts-ignore
  delete props.updatedDttm;
  // @ts-ignore
  delete props.isCached;
  // @ts-ignore
  delete props.isExpanded;

  renderWrapper(props);
  expect(
    screen.getByRole('menuitem', { name: 'Enter fullscreen' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: /Force refresh/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Show chart description' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Edit chart' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Download' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Share' })).toBeInTheDocument();

  expect(
    screen.getByRole('button', { name: 'More Options' }),
  ).toBeInTheDocument();
  expect(screen.getByTestId('NoAnimationDropdown')).toBeInTheDocument();
});

test('Should "export to CSV"', async () => {
  const props = createProps();
  renderWrapper(props);
  expect(props.exportCSV).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to .CSV'));
  expect(props.exportCSV).toBeCalledTimes(1);
  expect(props.exportCSV).toBeCalledWith(371);
});

test('Should "export to Excel"', async () => {
  const props = createProps();
  renderWrapper(props);
  expect(props.exportXLSX).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to Excel'));
  expect(props.exportXLSX).toBeCalledTimes(1);
  expect(props.exportXLSX).toBeCalledWith(371);
});

test('Export full CSV is under featureflag', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: false,
  };
  const props = createProps('table');
  renderWrapper(props);
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
  expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
});

test('Should "export full CSV"', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  const props = createProps('table');
  renderWrapper(props);
  expect(props.exportFullCSV).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to full .CSV'));
  expect(props.exportFullCSV).toBeCalledTimes(1);
  expect(props.exportFullCSV).toBeCalledWith(371);
});

test('Should not show export full CSV if report is not table', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  renderWrapper();
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
  expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
});

test('Export full Excel is under featureflag', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: false,
  };
  const props = createProps('table');
  renderWrapper(props);
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to Excel')).toBeInTheDocument();
  expect(screen.queryByText('Export to full Excel')).not.toBeInTheDocument();
});

test('Should "export full Excel"', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  const props = createProps('table');
  renderWrapper(props);
  expect(props.exportFullXLSX).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to full Excel'));
  expect(props.exportFullXLSX).toBeCalledTimes(1);
  expect(props.exportFullXLSX).toBeCalledWith(371);
});

test('Should not show export full Excel if report is not table', async () => {
  (global as any).featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  renderWrapper();
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to Excel')).toBeInTheDocument();
  expect(screen.queryByText('Export to full Excel')).not.toBeInTheDocument();
});

test('Should "Show chart description"', () => {
  const props = createProps();
  renderWrapper(props);
  expect(props.toggleExpandSlice).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Show chart description'));
  expect(props.toggleExpandSlice).toBeCalledTimes(1);
  expect(props.toggleExpandSlice).toBeCalledWith(371);
});

test('Should "Force refresh"', () => {
  const props = createProps();
  renderWrapper(props);
  expect(props.forceRefresh).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Force refresh'));
  expect(props.forceRefresh).toBeCalledTimes(1);
  expect(props.forceRefresh).toBeCalledWith(371, 26);
  expect(props.addSuccessToast).toBeCalledTimes(1);
});

test('Should "Enter fullscreen"', () => {
  const props = createProps();
  renderWrapper(props);

  expect(props.handleToggleFullSize).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Enter fullscreen'));
  expect(props.handleToggleFullSize).toBeCalledTimes(1);
});

test('Drill to detail modal is under featureflag', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: false,
  };
  const props = createProps();
  renderWrapper(props);
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Should show "Drill to detail" with `can_explore` & `can_samples` perms', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
  };
  const props = {
    ...createProps(),
    supersetCanExplore: true,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['can_samples', 'Datasource']],
  });
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Should show "Drill to detail" with `can_drill` & `can_samples` perms', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
  };
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [
      ['can_samples', 'Datasource'],
      ['can_drill', 'Dashboard'],
    ],
  });
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Should show "Drill to detail" with both `canexplore` + `can_drill` & `can_samples` perms', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
  };
  const props = {
    ...createProps(),
    supersetCanExplore: true,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [
      ['can_samples', 'Datasource'],
      ['can_drill', 'Dashboard'],
    ],
  });
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Should not show "Drill to detail" with neither of required perms', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
  };
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['invalid_permission', 'Dashboard']],
  });
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Should not show "Drill to detail" only `can_dril` perm', () => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
  };
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['can_drill', 'Dashboard']],
  });
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Should show "View query"', () => {
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['can_view_query', 'Dashboard']],
  });
  expect(screen.getByText('View query')).toBeInTheDocument();
});

test('Should not show "View query"', () => {
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['invalid_permission', 'Dashboard']],
  });
  expect(screen.queryByText('View query')).not.toBeInTheDocument();
});

test('Should show "View as table"', () => {
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['can_view_chart_as_table', 'Dashboard']],
  });
  expect(screen.getByText('View as table')).toBeInTheDocument();
});

test('Should not show "View as table"', () => {
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [['invalid_permission', 'Dashboard']],
  });
  expect(screen.queryByText('View as table')).not.toBeInTheDocument();
});

test('Should not show the "Edit chart" button', () => {
  const props = {
    ...createProps(),
    supersetCanExplore: false,
  };
  props.slice.slice_id = 18;
  renderWrapper(props, {
    Admin: [
      ['can_samples', 'Datasource'],
      ['can_view_query', 'Dashboard'],
      ['can_view_chart_as_table', 'Dashboard'],
    ],
  });
  expect(screen.queryByText('Edit chart')).not.toBeInTheDocument();
});

describe('handleDropdownNavigation', () => {
  const mockToggleDropdown = jest.fn();
  const mockSetSelectedKeys = jest.fn();
  const mockSetOpenKeys = jest.fn();

  const menu = (
    <Menu selectedKeys={['item1']}>
      <Menu.Item key="item1">Item 1</Menu.Item>
      <Menu.Item key="item2">Item 2</Menu.Item>
      <Menu.Item key="item3">Item 3</Menu.Item>
    </Menu>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should continue with system tab navigation if dropdown is closed and tab key is pressed', () => {
    const event = {
      key: 'Tab',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      false,
      <div />,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockToggleDropdown).not.toHaveBeenCalled();
    expect(mockSetSelectedKeys).not.toHaveBeenCalled();
  });

  test(`should prevent default behavior and toggle dropdown if dropdown
      is closed and action key is pressed`, () => {
    const event = {
      key: 'Enter',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      false,
      <div />,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockToggleDropdown).toHaveBeenCalled();
    expect(mockSetSelectedKeys).not.toHaveBeenCalled();
  });

  test(`should trigger menu item click,
      clear selected keys, close dropdown, and focus on menu trigger
      if action key is pressed and menu item is selected`, () => {
    const event = {
      key: 'Enter',
      preventDefault: jest.fn(),
      currentTarget: { focus: jest.fn() },
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      true,
      menu,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockToggleDropdown).toHaveBeenCalled();
    expect(mockSetSelectedKeys).toHaveBeenCalledWith([]);
    expect(event.currentTarget.focus).toHaveBeenCalled();
  });

  test('should select the next menu item if down arrow key is pressed', () => {
    const event = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      true,
      menu,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockSetSelectedKeys).toHaveBeenCalledWith(['item2']);
  });

  test('should select the previous menu item if up arrow key is pressed', () => {
    const event = {
      key: 'ArrowUp',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      true,
      menu,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockSetSelectedKeys).toHaveBeenCalledWith(['item1']);
  });

  test('should close dropdown menu if escape key is pressed', () => {
    const event = {
      key: 'Escape',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      true,
      <div />,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockToggleDropdown).toHaveBeenCalled();
    expect(mockSetSelectedKeys).not.toHaveBeenCalled();
  });

  test('should do nothing if an unsupported key is pressed', () => {
    const event = {
      key: 'Shift',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent<HTMLDivElement>;

    handleDropdownNavigation(
      event,
      true,
      <div />,
      mockToggleDropdown,
      mockSetSelectedKeys,
      mockSetOpenKeys,
    );
    expect(mockToggleDropdown).not.toHaveBeenCalled();
    expect(mockSetSelectedKeys).not.toHaveBeenCalled();
  });

  test('should find a child element with a key', () => {
    const item = {
      props: {
        children: [
          <div key="1">Child 1</div>,
          <div key="2">Child 2</div>,
          <div key="3">Child 3</div>,
        ],
      },
    };

    const childWithKey = item?.props?.children?.find(
      (child: ReactElement) => child?.key,
    );

    expect(childWithKey).toBeDefined();
  });
});
