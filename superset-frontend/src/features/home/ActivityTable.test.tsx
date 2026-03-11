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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { TableTab } from 'src/views/CRUD/types';
import ActivityTable from './ActivityTable';

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';

const mockData = {
  [TableTab.Viewed]: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
  [TableTab.Created]: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
};

fetchMock.get(chartsEndpoint, {
  result: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
});

fetchMock.get(dashboardsEndpoint, {
  result: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
});

const mockSetActiveChild = jest.fn();

const activityProps = {
  activeChild: TableTab.Created,
  activityData: mockData,
  setActiveChild: mockSetActiveChild,
  user: { userId: '1' },
  isFetchingActivityData: false,
};

const activityEditedTabProps = {
  activeChild: TableTab.Edited,
  activityData: mockData,
  setActiveChild: mockSetActiveChild,
  user: { userId: '1' },
  isFetchingActivityData: false,
};

const activityViewedTabProps = {
  activeChild: TableTab.Viewed,
  activityData: mockData,
  setActiveChild: mockSetActiveChild,
  user: { userId: '1' },
  isFetchingActivityData: false,
};

const emptyActivityProps = {
  activeChild: TableTab.Created,
  activityData: {},
  setActiveChild: mockSetActiveChild,
  user: { userId: '1' },
  isFetchingActivityData: false,
};

const renderOptions = {
  useRedux: true,
  useRouter: true,
};

const renderActivityTable = (props: any) =>
  render(<ActivityTable {...props} />, renderOptions);

test('the component renders with ActivityCards', async () => {
  renderActivityTable(activityProps);
  expect(screen.getByText(/dashboard_test/i)).toBeInTheDocument();
});
test('renders tabs with three buttons', async () => {
  renderActivityTable(activityProps);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
});
test('renders Viewed tab with ActivityCards', async () => {
  renderActivityTable(activityViewedTabProps);
  expect(screen.getByText(/chartychart/i)).toBeInTheDocument();
});
test('calls the getEdited batch call when edited tab is clicked', async () => {
  const { rerender } = renderActivityTable(activityProps);
  const editedButton = screen.getByText(/edited/i);
  expect(editedButton).toBeInTheDocument();
  userEvent.click(editedButton);
  expect(mockSetActiveChild).toHaveBeenCalledWith(TableTab.Edited);
  rerender(<ActivityTable {...activityEditedTabProps} />);
  // simulate the render after getEditedObjects has been called
  await waitFor(() => {
    expect(screen.getByText(/chartychart/i)).toBeInTheDocument();
    expect(screen.getByText(/dashboard_test/i)).toBeInTheDocument();
  });
});
test('show empty state if there is no data', () => {
  renderActivityTable(emptyActivityProps);
  expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
});
