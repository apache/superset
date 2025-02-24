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
import { SupersetClient } from '@superset-ui/core';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import fetchMock from 'fetch-mock';
import * as hooks from 'src/views/CRUD/hooks';
import DashboardTable from './DashboardTable';

jest.mock('src/views/CRUD/utils', () => ({
  ...jest.requireActual('src/views/CRUD/utils'),
  handleDashboardDelete: jest
    .fn()
    .mockImplementation((dashboard, refreshData) => {
      refreshData();
      return Promise.resolve();
    }),
}));

// Mock the CRUD hooks
jest.mock('src/views/CRUD/hooks', () => ({
  ...jest.requireActual('src/views/CRUD/hooks'),
  useListViewResource: jest.fn().mockReturnValue({
    state: {
      loading: false,
      resourceCollection: [],
      resourceCount: 0,
      bulkSelectEnabled: false,
      lastFetched: undefined,
    },
    setResourceCollection: jest.fn(),
    hasPerm: jest.fn().mockReturnValue(true),
    refreshData: jest.fn(),
    fetchData: jest.fn(),
    toggleBulkSelect: jest.fn(),
  }),
  useFavoriteStatus: jest.fn().mockReturnValue([jest.fn(), {}]),
}));

const mockDashboards = [
  {
    id: 1,
    dashboard_title: 'Test Dashboard 1',
    changed_on_delta_humanized: '1 day ago',
    url: '/dashboard/1',
    thumbnail_url: '/thumbnail/1',
  },
  {
    id: 2,
    dashboard_title: 'Test Dashboard 2',
    changed_on_delta_humanized: '2 days ago',
    url: '/dashboard/2',
    thumbnail_url: '/thumbnail/2',
  },
];

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

const defaultProps = {
  user: mockUser,
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  mine: [],
  showThumbnails: true,
  otherTabData: [],
  otherTabFilters: [],
  otherTabTitle: 'Examples',
};

describe('DashboardTable', () => {
  const history = createMemoryHistory();
  const store = configureStore({
    reducer: {
      dashboards: (state = { dashboards: [] }) => state,
    },
    preloadedState: {
      dashboards: {
        dashboards: mockDashboards,
      },
    },
  });

  beforeEach(() => {
    jest.spyOn(SupersetClient, 'get').mockImplementation(() =>
      Promise.resolve({
        json: {
          result: mockDashboards[0],
        },
        response: new Response(),
      }),
    );

    fetchMock.get(
      'glob:*/api/v1/dashboard/*',
      {
        result: mockDashboards[0],
      },
      { overwriteRoutes: true },
    ); // Add overwriteRoutes option

    // Mock loading state for first render
    jest.spyOn(hooks, 'useListViewResource').mockImplementationOnce(() => ({
      state: {
        loading: true,
        resourceCollection: [],
        resourceCount: 0,
        bulkSelectEnabled: false,
        lastFetched: undefined,
      },
      setResourceCollection: jest.fn(),
      hasPerm: jest.fn().mockReturnValue(true),
      refreshData: jest.fn(),
      fetchData: jest.fn(),
      toggleBulkSelect: jest.fn(),
    }));
  });

  it('renders loading state initially', () => {
    render(
      <Router history={history}>
        <DashboardTable {...defaultProps} />
      </Router>,
      { store },
    );
    expect(screen.getByRole('img', { name: 'empty' })).toBeInTheDocument();
  });

  it('renders empty state when no dashboards', async () => {
    render(
      <Router history={history}>
        <DashboardTable {...defaultProps} />
      </Router>,
      { store },
    );

    await waitFor(() => {
      expect(screen.getByText('No results')).toBeInTheDocument();
    });
  });

  it('renders dashboard cards when data is loaded', async () => {
    jest.spyOn(hooks, 'useListViewResource').mockImplementation(() => ({
      state: {
        loading: false,
        resourceCollection: mockDashboards,
        resourceCount: mockDashboards.length,
        bulkSelectEnabled: false,
        lastFetched: new Date().toISOString(),
      },
      setResourceCollection: jest.fn(),
      hasPerm: jest.fn().mockReturnValue(true),
      refreshData: jest.fn(),
      fetchData: jest.fn(),
      toggleBulkSelect: jest.fn(),
    }));

    render(
      <Router history={history}>
        <DashboardTable {...defaultProps} mine={mockDashboards} />
      </Router>,
      { store },
    );

    await waitFor(() => {
      mockDashboards.forEach(dashboard => {
        expect(screen.getByText(dashboard.dashboard_title)).toBeInTheDocument();
      });
    });
  });

  it('switches to Mine tab correctly', async () => {
    const props = {
      ...defaultProps,
      mine: mockDashboards,
    };

    render(
      <Router history={history}>
        <DashboardTable {...props} />
      </Router>,
      { store },
    );

    const mineTab = screen.getByRole('menuitem', { name: /mine/i });
    await userEvent.click(mineTab);
    await waitFor(() => {
      expect(mineTab).toHaveClass('ant-menu-item-selected');
    });
  });

  it('handles create dashboard button click', async () => {
    const assignMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: assignMock },
      writable: true,
    });

    render(
      <Router history={history}>
        <DashboardTable {...defaultProps} />
      </Router>,
      { store },
    );

    const createButton = screen.getByRole('button', { name: /dashboard$/i });
    await userEvent.click(createButton);
    expect(assignMock).toHaveBeenCalledWith('/dashboard/new');
  });

  it('switches to Other tab when available', async () => {
    const props = {
      ...defaultProps,
      otherTabData: mockDashboards,
      otherTabTitle: 'Examples',
    };

    render(
      <Router history={history}>
        <DashboardTable {...props} />
      </Router>,
      { store },
    );

    const otherTab = screen.getByRole('tab', { name: 'Examples' });
    await userEvent.click(otherTab);
    expect(otherTab).toHaveClass('active');
  });

  it('handles bulk dashboard export', async () => {
    const props = {
      ...defaultProps,
      mine: mockDashboards,
    };

    render(
      <Router history={history}>
        <DashboardTable {...props} />
      </Router>,
      { store },
    );

    const moreOptionsButton = screen.getAllByRole('img', {
      name: 'more-vert',
    })[0];
    await userEvent.click(moreOptionsButton);

    // Wait for dropdown menu to appear
    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    const exportOption = screen.getByText('Export');
    await userEvent.click(exportOption);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles dashboard deletion confirmation', async () => {
    const props = {
      ...defaultProps,
      mine: mockDashboards,
    };

    const refreshDataMock = jest.fn();
    jest.spyOn(hooks, 'useListViewResource').mockImplementation(() => ({
      state: {
        loading: false,
        resourceCollection: mockDashboards,
        resourceCount: mockDashboards.length,
        bulkSelectEnabled: false,
        lastFetched: new Date().toISOString(),
      },
      setResourceCollection: jest.fn(),
      hasPerm: jest.fn().mockReturnValue(true),
      refreshData: refreshDataMock,
      fetchData: jest.fn(),
      toggleBulkSelect: jest.fn(),
    }));

    render(
      <Router history={history}>
        <DashboardTable {...props} />
      </Router>,
      { store },
    );

    const moreOptionsButton = screen.getAllByLabelText('more-vert')[0];
    await userEvent.click(moreOptionsButton);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteOption = screen.getByText('Delete');
    await userEvent.click(deleteOption);

    // Verify Delete button is initially disabled
    const confirmDeleteButton = screen.getByTestId('modal-confirm-button');
    expect(confirmDeleteButton).toBeDisabled();

    // Type DELETE in the confirmation input
    const deleteInput = screen.getByTestId('delete-modal-input');
    await userEvent.type(deleteInput, 'DELETE');

    // Verify Delete button becomes enabled
    await waitFor(() => {
      expect(confirmDeleteButton).toBeEnabled();
    });

    // Click the now-enabled Delete button
    await userEvent.click(confirmDeleteButton);

    await waitFor(
      () => {
        expect(refreshDataMock).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
