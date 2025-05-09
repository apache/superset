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
import { NativeFilterType } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import HorizontalBar from './Horizontal';

const defaultProps = {
  actions: null,
  canEdit: true,
  dashboardId: 1,
  dataMaskSelected: {},
  filterValues: [],
  isInitialized: true,
  onSelectionChange: jest.fn(),
};

const renderWrapper = (overrideProps?: Record<string, any>) =>
  waitFor(() =>
    render(<HorizontalBar {...defaultProps} {...overrideProps} />, {
      useRedux: true,
      initialState: {
        dashboardState: {
          sliceIds: [],
        },
        dashboardInfo: {
          dash_edit_perm: true,
        },
      },
    }),
  );

test('should render', async () => {
  const { container } = await renderWrapper();
  expect(container).toBeInTheDocument();
});

test('should not render the empty message', async () => {
  await renderWrapper({
    filterValues: [
      {
        id: 'test',
        type: NativeFilterType.NativeFilter,
      },
    ],
  });
  expect(
    screen.queryByText('No filters are currently added to this dashboard.'),
  ).not.toBeInTheDocument();
});

test('should render the empty message', async () => {
  await renderWrapper();
  expect(
    screen.getByText('No filters are currently added to this dashboard.'),
  ).toBeInTheDocument();
});

test('should not render the loading icon', async () => {
  await renderWrapper();
  expect(
    screen.queryByRole('status', { name: 'Loading' }),
  ).not.toBeInTheDocument();
});

test('should render the loading icon', async () => {
  await renderWrapper({
    isInitialized: false,
  });
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
});
