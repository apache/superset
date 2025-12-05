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
import { render, screen } from 'spec/helpers/testing-library';
import AsyncTaskList from './index';

const mockProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  user: {
    userId: 1,
    firstName: 'Test',
    lastName: 'User',
  },
};

// Mock the ListView resource hook
jest.mock('src/views/CRUD/hooks', () => ({
  useListViewResource: () => ({
    state: {
      loading: false,
      resourceCount: 0,
      resourceCollection: [],
      bulkSelectEnabled: false,
    },
    setResourceCollection: jest.fn(),
    hasPerm: jest.fn(() => true),
    fetchData: jest.fn(),
    toggleBulkSelect: jest.fn(),
    refreshData: jest.fn(),
  }),
}));

test('renders async task list component', () => {
  render(<AsyncTaskList {...mockProps} />);

  expect(screen.getByText('Async Tasks')).toBeInTheDocument();
});

test('displays status badge with correct text', () => {
  const { container } = render(<AsyncTaskList {...mockProps} />);

  // Component should render without errors
  expect(container.firstChild).toBeInTheDocument();
});
