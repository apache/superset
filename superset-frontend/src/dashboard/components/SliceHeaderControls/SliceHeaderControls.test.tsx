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

import userEvent from '@testing-library/user-event';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { FeatureFlag } from 'src/featureFlags';
import SliceHeaderControls from '.';

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

const createProps = (viz_type = 'sunburst') => ({
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  exploreChart: jest.fn(),
  exportCSV: jest.fn(),
  exportFullCSV: jest.fn(),
  forceRefresh: jest.fn(),
  handleToggleFullSize: jest.fn(),
  toggleExpandSlice: jest.fn(),
  onExploreChart: jest.fn(),
  slice: {
    slice_id: 371,
    slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20371%7D',
    slice_name: 'Vaccine Candidates per Country & Stage',
    slice_description: 'Table of vaccine candidates for 100 countries',
    form_data: {
      adhoc_filters: [],
      color_scheme: 'supersetColors',
      datasource: '58__table',
      groupby: ['product_category', 'clinical_stage'],
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
  sliceCanEdit: false,
  componentId: 'CHART-fYo7IyvKZQ',
  dashboardId: 26,
  isFullSize: false,
  chartStatus: 'rendered',
  showControls: true,
  supersetCanShare: true,
  formData: { slice_id: 1, datasource: '58__table', viz_type: 'sunburst' },
});

test('Should render', () => {
  const props = createProps();
  render(<SliceHeaderControls {...props} />, { useRedux: true });
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
  delete props.cachedDttm;
  // @ts-ignore
  delete props.updatedDttm;
  // @ts-ignore
  delete props.isCached;
  // @ts-ignore
  delete props.isExpanded;
  // @ts-ignore
  delete props.sliceCanEdit;

  render(<SliceHeaderControls {...props} />, { useRedux: true });
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
  render(<SliceHeaderControls {...props} />, { useRedux: true });

  expect(props.exportCSV).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to .CSV'));
  expect(props.exportCSV).toBeCalledTimes(1);
  expect(props.exportCSV).toBeCalledWith(371);
});

test('Should not show "Download" if slice is filter box', () => {
  const props = createProps('filter_box');
  render(<SliceHeaderControls {...props} />, { useRedux: true });
  expect(screen.queryByText('Download')).not.toBeInTheDocument();
});

test('Export full CSV is under featureflag', async () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.ALLOW_FULL_CSV_EXPORT]: false,
  };
  const props = createProps('table');
  render(<SliceHeaderControls {...props} />, { useRedux: true });
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
  expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
});

test('Should "export full CSV"', async () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.ALLOW_FULL_CSV_EXPORT]: true,
  };
  const props = createProps('table');
  render(<SliceHeaderControls {...props} />, { useRedux: true });
  expect(props.exportFullCSV).toBeCalledTimes(0);
  userEvent.hover(screen.getByText('Download'));
  userEvent.click(await screen.findByText('Export to full .CSV'));
  expect(props.exportFullCSV).toBeCalledTimes(1);
  expect(props.exportFullCSV).toBeCalledWith(371);
});

test('Should not show export full CSV if report is not table', async () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.ALLOW_FULL_CSV_EXPORT]: true,
  };
  const props = createProps();
  render(<SliceHeaderControls {...props} />, { useRedux: true });
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
  expect(screen.queryByText('Export to full .CSV')).not.toBeInTheDocument();
});

test('Should "Show chart description"', () => {
  const props = createProps();
  render(<SliceHeaderControls {...props} />, { useRedux: true });

  expect(props.toggleExpandSlice).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Show chart description'));
  expect(props.toggleExpandSlice).toBeCalledTimes(1);
  expect(props.toggleExpandSlice).toBeCalledWith(371);
});

test('Should "Force refresh"', () => {
  const props = createProps();
  render(<SliceHeaderControls {...props} />, { useRedux: true });

  expect(props.forceRefresh).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Force refresh'));
  expect(props.forceRefresh).toBeCalledTimes(1);
  expect(props.forceRefresh).toBeCalledWith(371, 26);
  expect(props.addSuccessToast).toBeCalledTimes(1);
});

test('Should "Enter fullscreen"', () => {
  const props = createProps();
  render(<SliceHeaderControls {...props} />, { useRedux: true });

  expect(props.handleToggleFullSize).toBeCalledTimes(0);
  userEvent.click(screen.getByText('Enter fullscreen'));
  expect(props.handleToggleFullSize).toBeCalledTimes(1);
});
