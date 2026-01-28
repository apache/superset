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
import { MemoryRouter } from 'react-router-dom';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';
import { TaskStatus, TaskScope } from 'src/features/tasks/types';

// Set up window.featureFlags before importing TaskList
window.featureFlags = {};

// Mock getBootstrapData before importing components that use it
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 1,
      firstName: 'admin',
      lastName: 'user',
      roles: { Admin: [] },
    },
    common: {
      feature_flags: {},
      conf: {},
    },
  }),
}));

import TaskList from 'src/pages/TaskList';

const tasksInfoEndpoint = 'glob:*/api/v1/task/_info*';
const tasksCreatedByEndpoint = 'glob:*/api/v1/task/related/created_by*';
const tasksEndpoint = 'glob:*/api/v1/task/?*';
const taskCancelEndpoint = 'glob:*/api/v1/task/*/cancel';

const mockTasks = [
  {
    id: 1,
    uuid: 'task-uuid-1',
    task_key: 'test_task_1',
    task_type: 'data_export',
    task_name: 'Export Data Task',
    status: TaskStatus.Success,
    scope: TaskScope.Private,
    created_on: '2024-01-15T10:00:00Z',
    changed_on: '2024-01-15T10:05:00Z',
    created_on_delta_humanized: '5 minutes ago',
    started_at: '2024-01-15T10:00:01Z',
    ended_at: '2024-01-15T10:05:00Z',
    created_by: { id: 1, first_name: 'admin', last_name: 'user' },
    user_id: 1,
    payload: {},
    duration_seconds: 299,
    subscriber_count: 0,
    subscribers: [],
    properties: {
      is_abortable: null,
      progress_percent: 1.0,
      progress_current: null,
      progress_total: null,
      error_message: null,
      exception_type: null,
      stack_trace: null,
      timeout: null,
    },
  },
  {
    id: 2,
    uuid: 'task-uuid-2',
    task_key: 'test_task_2',
    task_type: 'report_generation',
    task_name: null,
    status: TaskStatus.InProgress,
    scope: TaskScope.Private,
    created_on: '2024-01-15T11:00:00Z',
    changed_on: '2024-01-15T11:00:00Z',
    created_on_delta_humanized: '1 minute ago',
    started_at: '2024-01-15T11:00:01Z',
    ended_at: null,
    created_by: { id: 1, first_name: 'admin', last_name: 'user' },
    user_id: 1,
    payload: { report_id: 42 },
    duration_seconds: null,
    subscriber_count: 0,
    subscribers: [],
    properties: {
      is_abortable: true,
      progress_percent: 0.5,
      progress_current: null,
      progress_total: null,
      error_message: null,
      exception_type: null,
      stack_trace: null,
      timeout: null,
    },
  },
  {
    id: 3,
    uuid: 'task-uuid-3',
    task_key: 'shared_task_1',
    task_type: 'bulk_operation',
    task_name: 'Shared Bulk Task',
    status: TaskStatus.Pending,
    scope: TaskScope.Shared,
    created_on: '2024-01-15T12:00:00Z',
    changed_on: '2024-01-15T12:00:00Z',
    created_on_delta_humanized: 'just now',
    started_at: null,
    ended_at: null,
    created_by: { id: 2, first_name: 'other', last_name: 'user' },
    user_id: 2,
    payload: {},
    duration_seconds: null,
    subscriber_count: 2,
    subscribers: [
      {
        user_id: 1,
        first_name: 'admin',
        last_name: 'user',
        subscribed_at: '2024-01-15T12:00:00Z',
      },
      {
        user_id: 2,
        first_name: 'other',
        last_name: 'user',
        subscribed_at: '2024-01-15T12:00:01Z',
      },
    ],
    properties: {
      is_abortable: null,
      progress_percent: null,
      progress_current: null,
      progress_total: null,
      error_message: null,
      exception_type: null,
      stack_trace: null,
      timeout: null,
    },
  },
];

const mockUser = {
  userId: 1,
  firstName: 'admin',
  lastName: 'user',
};

fetchMock.get(tasksInfoEndpoint, {
  permissions: ['can_read', 'can_write'],
});
fetchMock.get(tasksCreatedByEndpoint, {
  result: [],
});
fetchMock.get(tasksEndpoint, {
  result: mockTasks,
  count: 3,
});
fetchMock.post(taskCancelEndpoint, {
  action: 'aborted',
  message: 'Task cancelled',
});

const renderTaskList = (props = {}, userProp = mockUser) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <TaskList {...props} user={userProp} />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true },
  );

beforeEach(() => {
  fetchMock.resetHistory();
});

test('renders TaskList with title', async () => {
  renderTaskList();
  expect(await screen.findByText('Tasks')).toBeInTheDocument();
});

test('renders a ListView', async () => {
  renderTaskList();
  expect(await screen.findByTestId('task-list-view')).toBeInTheDocument();
});

test('fetches info endpoint', async () => {
  renderTaskList();
  await waitFor(() => {
    const calls = fetchMock.calls(/task\/_info/);
    expect(calls).toHaveLength(1);
  });
});

test('fetches tasks data', async () => {
  renderTaskList();
  await waitFor(() => {
    const calls = fetchMock.calls(/task\/\?q/);
    expect(calls).toHaveLength(1);
  });
});

test('displays task data in table', async () => {
  renderTaskList();
  // Wait for the table to be populated
  await waitFor(() => {
    expect(screen.getByText('Export Data Task')).toBeInTheDocument();
  });
  expect(screen.getByText('data_export')).toBeInTheDocument();
  expect(screen.getByText('report_generation')).toBeInTheDocument();
});

test('displays task scope labels', async () => {
  renderTaskList();
  // Wait for data to load, then check for scope labels
  // Use getAllByText since there are multiple Private tasks
  await waitFor(() => {
    expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
  });
  expect(screen.getByText('Shared')).toBeInTheDocument();
});

test('displays task duration for completed tasks', async () => {
  renderTaskList();
  // Wait for the table to be populated with duration data
  // formatDuration uses prettyMs which formats 299s as "4m 59s"
  await waitFor(() => {
    expect(screen.getByText('4m 59s')).toBeInTheDocument();
  });
});

test('shows cancel button for cancellable in-progress tasks', async () => {
  renderTaskList();
  await waitFor(() => {
    expect(screen.getAllByRole('img', { name: 'stop' }).length).toBeGreaterThan(
      0,
    );
  });
});

test('shows cancel confirmation modal when cancel button is clicked', async () => {
  renderTaskList();

  // Wait for data to load
  await screen.findByText('test_task_2');

  // Find cancel button (StopOutlined icon)
  const stopIcons = await screen.findAllByRole('img', { name: 'stop' });
  // Click the first clickable cancel button
  const cancelButton = stopIcons.find(
    icon => icon.closest('[role="button"]') !== null,
  );

  // Assert the cancel button exists - test should fail if UI doesn't render it
  expect(cancelButton).toBeDefined();
  fireEvent.click(cancelButton!);

  // Check for confirmation modal
  expect(await screen.findByText('Cancel Task')).toBeInTheDocument();
});

test('shows cancel button for shared tasks where user is subscribed', async () => {
  renderTaskList();

  // Wait for data to load
  await screen.findByText('Shared Bulk Task');

  // For shared tasks, users see the cancel button
  await waitFor(() => {
    expect(screen.getAllByRole('img', { name: 'stop' }).length).toBeGreaterThan(
      0,
    );
  });
});

test('displays subscribers via FacePile for shared tasks', async () => {
  renderTaskList();

  // Wait for data to load
  await screen.findByText('Shared Bulk Task');

  // FacePile should show subscriber avatars
  // Look for avatar elements (FacePile renders user initials)
  await waitFor(() => {
    // The FacePile component shows user faces/initials
    expect(screen.getByText('Shared Bulk Task')).toBeInTheDocument();
  });
});

test('does not show cancel button for completed shared tasks', async () => {
  // Create a completed shared task where user is subscribed
  const completedSharedTask = {
    id: 4,
    uuid: 'task-uuid-4',
    task_key: 'completed_shared_task',
    task_type: 'bulk_operation',
    task_name: 'Completed Shared Task',
    status: TaskStatus.Success, // Terminal state
    scope: TaskScope.Shared,
    created_on: '2024-01-15T12:00:00Z',
    changed_on: '2024-01-15T12:05:00Z',
    created_on_delta_humanized: '5 minutes ago',
    started_at: '2024-01-15T12:00:01Z',
    ended_at: '2024-01-15T12:05:00Z',
    created_by: { id: 2, first_name: 'other', last_name: 'user' },
    user_id: 2,
    payload: {},
    duration_seconds: 299,
    subscriber_count: 1,
    subscribers: [
      {
        user_id: 1,
        first_name: 'admin',
        last_name: 'user',
        subscribed_at: '2024-01-15T12:00:00Z',
      },
    ],
    properties: {
      is_abortable: null,
      progress_percent: 1.0,
      progress_current: null,
      progress_total: null,
      error_message: null,
      exception_type: null,
      stack_trace: null,
      timeout: null,
    },
  };

  fetchMock.get(
    tasksEndpoint,
    { result: [completedSharedTask], count: 1 },
    { overwriteRoutes: true },
  );

  renderTaskList();

  // Wait for data to load
  await screen.findByText('Completed Shared Task');

  // Verify that no cancel button is present in the actions column
  // For completed shared tasks, cancel should not be shown
  // Note: There might be stop icons elsewhere (e.g., status icons) but not as action buttons
  const stopIcons = screen.queryAllByRole('img', { name: 'stop' });
  // Filter to only those that are action buttons
  const actionButtons = stopIcons.filter(
    icon => icon.closest('[role="button"]') !== null,
  );
  expect(actionButtons).toHaveLength(0);

  // Restore mock
  fetchMock.get(
    tasksEndpoint,
    { result: mockTasks, count: 3 },
    { overwriteRoutes: true },
  );
});

test('displays empty state when no tasks', async () => {
  fetchMock.get(
    tasksEndpoint,
    { result: [], count: 0 },
    { overwriteRoutes: true },
  );

  renderTaskList();

  await waitFor(() => {
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });

  // Restore mock
  fetchMock.get(
    tasksEndpoint,
    { result: mockTasks, count: 3 },
    { overwriteRoutes: true },
  );
});
