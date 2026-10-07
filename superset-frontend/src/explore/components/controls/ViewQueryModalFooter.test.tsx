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

import { screen, render, fireEvent } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import ViewQueryModalFooter from './ViewQueryModalFooter';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

const mockDatasource = {
  id: '1',
  type: 'table',
  sql: 'select * from table',
};

const expectedPayload = {
  datasourceKey: '1__table',
  sql: mockDatasource.sql,
};

let postFormSpy: jest.SpyInstance;

beforeEach(() => {
  postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
  mockHistoryPush.mockReset();
});

const setup = () =>
  render(<ViewQueryModalFooter datasource={mockDatasource} />, {
    useRouter: true,
  });

test('navigates to SQL Lab in the same tab on a plain click', () => {
  setup();

  fireEvent.click(screen.getByText('Open in SQL Lab'));

  expect(postFormSpy).not.toHaveBeenCalled();
  expect(mockHistoryPush).toHaveBeenCalledWith({
    pathname: '/sqllab',
    state: {
      requestedQuery: expectedPayload,
    },
  });
});

test('opens SQL Lab in a new window on Cmd+click', () => {
  setup();

  fireEvent.click(screen.getByText('Open in SQL Lab'), { metaKey: true });

  expect(postFormSpy).toHaveBeenCalledWith('/sqllab/', {
    form_data: JSON.stringify(expectedPayload),
  });
  expect(mockHistoryPush).not.toHaveBeenCalled();
});

test('opens SQL Lab in a new window on Ctrl+click', () => {
  setup();

  fireEvent.click(screen.getByText('Open in SQL Lab'), { ctrlKey: true });

  expect(postFormSpy).toHaveBeenCalledWith('/sqllab/', {
    form_data: JSON.stringify(expectedPayload),
  });
  expect(mockHistoryPush).not.toHaveBeenCalled();
});
