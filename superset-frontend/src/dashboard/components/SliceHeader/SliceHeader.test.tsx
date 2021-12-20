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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import SliceHeader from '.';

jest.mock('src/dashboard/components/SliceHeaderControls', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-test="SliceHeaderControls"
      data-slice={JSON.stringify(props.slice)}
      data-is-cached={props.isCached}
      data-is-expanded={props.isExpanded}
      data-cached-dttm={props.cachedDttm}
      data-updated-dttm={props.updatedDttm}
      data-superset-can-explore={props.supersetCanExplore}
      data-superset-can-csv={props.supersetCanCSV}
      data-slice-can-edit={props.sliceCanEdit}
      data-component-id={props.componentId}
      data-dashboard-id={props.dashboardId}
      data-is-full-size={props.isFullSize}
      data-chart-status={props.chartStatus}
    >
      <button
        type="button"
        data-test="toggleExpandSlice"
        onClick={props.toggleExpandSlice}
      >
        toggleExpandSlice
      </button>
      <button
        type="button"
        data-test="forceRefresh"
        onClick={props.forceRefresh}
      >
        forceRefresh
      </button>

      <button
        type="button"
        data-test="exploreChart"
        onClick={props.logExploreChart}
      >
        exploreChart
      </button>

      <button type="button" data-test="exportCSV" onClick={props.exportCSV}>
        exportCSV
      </button>

      <button
        type="button"
        data-test="handleToggleFullSize"
        onClick={props.handleToggleFullSize}
      >
        handleToggleFullSize
      </button>

      <button
        type="button"
        data-test="addSuccessToast"
        onClick={props.addSuccessToast}
      >
        addSuccessToast
      </button>

      <button
        type="button"
        data-test="addDangerToast"
        onClick={props.addDangerToast}
      >
        addDangerToast
      </button>
    </div>
  ),
}));

jest.mock('src/dashboard/components/FiltersBadge', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-test="FiltersBadge" data-chart-id={props.chartId} />
  ),
}));

const createProps = () => ({
  filters: {}, // is in typing but not being used
  editMode: false,
  annotationQuery: { param01: 'annotationQuery' } as any,
  annotationError: { param01: 'annotationError' } as any,
  cachedDttm: [] as string[],
  updatedDttm: 1617207718004,
  isCached: [false],
  isExpanded: false,
  sliceName: 'Vaccine Candidates per Phase',
  supersetCanExplore: true,
  supersetCanCSV: true,
  sliceCanEdit: false,
  slice: {
    slice_id: 312,
    slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20312%7D',
    slice_name: 'Vaccine Candidates per Phase',
    form_data: {
      adhoc_filters: [],
      bottom_margin: 'auto',
      color_scheme: 'SUPERSET_DEFAULT',
      columns: [],
      datasource: '58__table',
      groupby: ['clinical_stage'],
      label_colors: {},
      metrics: ['count'],
      row_limit: 10000,
      show_legend: false,
      time_range: 'No filter',
      time_range_endpoints: ['inclusive', 'exclusive'],
      url_params: {},
      viz_type: 'dist_bar',
      x_ticks_layout: 'auto',
      y_axis_format: 'SMART_NUMBER',
      slice_id: 312,
    },
    viz_type: 'dist_bar',
    datasource: '58__table',
    description: '',
    description_markeddown: '',
    owners: [],
    modified: '<span class="no-wrap">20 hours ago</span>',
    changed_on: 1617143411366,
    slice_description: '',
  },
  componentId: 'CHART-aGfmWtliqA',
  dashboardId: 26,
  isFullSize: false,
  chartStatus: 'rendered',
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  handleToggleFullSize: jest.fn(),
  updateSliceName: jest.fn(),
  toggleExpandSlice: jest.fn(),
  forceRefresh: jest.fn(),
  logExploreChart: jest.fn(),
  exportCSV: jest.fn(),
  formData: {},
});

test('Should render', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(screen.getByTestId('slice-header')).toBeInTheDocument();
});

test('Should render - default props', () => {
  const props = createProps();

  // @ts-ignore
  delete props.forceRefresh;
  // @ts-ignore
  delete props.updateSliceName;
  // @ts-ignore
  delete props.toggleExpandSlice;
  // @ts-ignore
  delete props.logExploreChart;
  // @ts-ignore
  delete props.exportCSV;
  // @ts-ignore
  delete props.innerRef;
  // @ts-ignore
  delete props.editMode;
  // @ts-ignore
  delete props.annotationQuery;
  // @ts-ignore
  delete props.annotationError;
  // @ts-ignore
  delete props.cachedDttm;
  // @ts-ignore
  delete props.updatedDttm;
  // @ts-ignore
  delete props.isCached;
  // @ts-ignore
  delete props.isExpanded;
  // @ts-ignore
  delete props.sliceName;
  // @ts-ignore
  delete props.supersetCanExplore;
  // @ts-ignore
  delete props.supersetCanCSV;
  // @ts-ignore
  delete props.sliceCanEdit;

  render(<SliceHeader {...props} />, { useRedux: true });
  expect(screen.getByTestId('slice-header')).toBeInTheDocument();
});

test('Should render default props and "call" actions', () => {
  const props = createProps();

  // @ts-ignore
  delete props.forceRefresh;
  // @ts-ignore
  delete props.updateSliceName;
  // @ts-ignore
  delete props.toggleExpandSlice;
  // @ts-ignore
  delete props.logExploreChart;
  // @ts-ignore
  delete props.exportCSV;
  // @ts-ignore
  delete props.innerRef;
  // @ts-ignore
  delete props.editMode;
  // @ts-ignore
  delete props.annotationQuery;
  // @ts-ignore
  delete props.annotationError;
  // @ts-ignore
  delete props.cachedDttm;
  // @ts-ignore
  delete props.updatedDttm;
  // @ts-ignore
  delete props.isCached;
  // @ts-ignore
  delete props.isExpanded;
  // @ts-ignore
  delete props.sliceName;
  // @ts-ignore
  delete props.supersetCanExplore;
  // @ts-ignore
  delete props.supersetCanCSV;
  // @ts-ignore
  delete props.sliceCanEdit;

  render(<SliceHeader {...props} />, { useRedux: true });
  userEvent.click(screen.getByTestId('toggleExpandSlice'));
  userEvent.click(screen.getByTestId('forceRefresh'));
  userEvent.click(screen.getByTestId('exploreChart'));
  userEvent.click(screen.getByTestId('exportCSV'));
  userEvent.click(screen.getByTestId('addSuccessToast'));
  userEvent.click(screen.getByTestId('addDangerToast'));
  userEvent.click(screen.getByTestId('handleToggleFullSize'));
  expect(screen.getByTestId('slice-header')).toBeInTheDocument();
});

test('Should render title', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(screen.getByText('Vaccine Candidates per Phase')).toBeInTheDocument();
});

test('Should render "annotationsLoading"', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(
    screen.getByRole('img', {
      name: 'Annotation layers are still loading.',
    }),
  ).toBeInTheDocument();
});

test('Should render "annotationsError"', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(
    screen.getByRole('img', {
      name: 'One ore more annotation layers failed loading.',
    }),
  ).toBeInTheDocument();
});

test('Should not render "annotationsError" and "annotationsLoading"', () => {
  const props = createProps();
  props.annotationQuery = {};
  props.annotationError = {};
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(
    screen.queryByRole('img', {
      name: 'One ore more annotation layers failed loading.',
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('img', {
      name: 'Annotation layers are still loading.',
    }),
  ).not.toBeInTheDocument();
});

test('Correct props to "FiltersBadge"', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(screen.getByTestId('FiltersBadge')).toHaveAttribute(
    'data-chart-id',
    '312',
  );
});

test('Correct props to "SliceHeaderControls"', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-cached-dttm',
    '',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-chart-status',
    'rendered',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-component-id',
    'CHART-aGfmWtliqA',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-dashboard-id',
    '26',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-is-cached',
    'false',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-is-expanded',
    'false',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-is-full-size',
    'false',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-slice-can-edit',
    'false',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-superset-can-csv',
    'true',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-superset-can-explore',
    'true',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-test',
    'SliceHeaderControls',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-updated-dttm',
    '1617207718004',
  );
  expect(screen.getByTestId('SliceHeaderControls')).toHaveAttribute(
    'data-slice',
    JSON.stringify(props.slice),
  );
});

test('Correct actions to "SliceHeaderControls"', () => {
  const props = createProps();
  render(<SliceHeader {...props} />, { useRedux: true });

  expect(props.toggleExpandSlice).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('toggleExpandSlice'));
  expect(props.toggleExpandSlice).toBeCalledTimes(1);

  expect(props.forceRefresh).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('forceRefresh'));
  expect(props.forceRefresh).toBeCalledTimes(1);

  expect(props.logExploreChart).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('exploreChart'));
  expect(props.logExploreChart).toBeCalledTimes(1);

  expect(props.exportCSV).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('exportCSV'));
  expect(props.exportCSV).toBeCalledTimes(1);

  expect(props.addSuccessToast).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('addSuccessToast'));
  expect(props.addSuccessToast).toBeCalledTimes(1);

  expect(props.addDangerToast).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('addDangerToast'));
  expect(props.addDangerToast).toBeCalledTimes(1);

  expect(props.handleToggleFullSize).toBeCalledTimes(0);
  userEvent.click(screen.getByTestId('handleToggleFullSize'));
  expect(props.handleToggleFullSize).toBeCalledTimes(1);
});
