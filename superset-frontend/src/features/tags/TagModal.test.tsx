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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import TagModal from 'src/features/tags/TagModal';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { Tag } from 'src/views/CRUD/types';

const mockedProps = {
  onHide: () => {},
  refreshData: () => {},
  addSuccessToast: () => {},
  addDangerToast: () => {},
  show: true,
};

const fetchEditFetchObjects = `glob:*/api/v1/tag/get_objects/?tags=*`;

test('should render', () => {
  const { container } = render(<TagModal {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('renders correctly in create mode', () => {
  const { getByPlaceholderText, getByText } = render(
    <TagModal {...mockedProps} />,
  );

  expect(getByPlaceholderText('Name of your tag')).toBeInTheDocument();
  expect(getByText('Create Tag')).toBeInTheDocument();
});

test('description input has an accessible name', async () => {
  render(<TagModal {...mockedProps} />);
  expect(await screen.findByLabelText('Tag description')).toBeInTheDocument();
});

test('loads all chart options across API pages when scrolling', async () => {
  const charts = Array.from({ length: 104 }, (_, index) => ({
    id: index + 1,
    slice_name: `Chart ${String(index + 1).padStart(3, '0')}`,
  }));
  const chartRoute = 'glob:*/api/v1/chart/?q=*';
  fetchMock.get(chartRoute, ({ queryParams }) => {
    const query = queryParams?.get('q');
    const { page, page_size: pageSize = 20 } = rison.decode(query ?? '()') as {
      page: number;
      page_size?: number;
    };
    const start = page * pageSize;
    return {
      count: charts.length,
      result: charts.slice(start, start + pageSize),
    };
  });

  render(<TagModal {...mockedProps} />);
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Select charts' }),
  );
  expect(await screen.findByText('Chart 001')).toBeInTheDocument();

  // Trigger pagination by dispatching a scroll event on the virtual-list container
  const scrollContainer = document.querySelector(
    '.ant-select-dropdown-list-holder',
  );
  if (!scrollContainer)
    throw new Error('Chart dropdown scroll container missing');
  Object.defineProperties(scrollContainer, {
    scrollHeight: { value: 10000 },
    offsetHeight: { value: 256 },
    scrollTop: { get: () => 10000, set: () => {} },
  });
  fireEvent.scroll(scrollContainer);

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(chartRoute)).toHaveLength(2),
  );
  await waitFor(() =>
    expect(document.querySelector('.ant-select-suffix .ant-spin')).toBeNull(),
  );
  // Scroll through the newly loaded options so the final chart is rendered.
  fireEvent.scroll(scrollContainer);

  expect(await screen.findByText('Chart 104')).toBeInTheDocument();
});

test('renders correctly in edit mode', () => {
  fetchMock.get(fetchEditFetchObjects, [[]]);
  const editTag: Tag = {
    id: 1,
    name: 'Test Tag',
    description: 'A test tag',
    type: 'dashboard',
    changed_on_delta_humanized: '',
    created_on_delta_humanized: '',
    created_by: {
      id: 1,
      first_name: 'joe',
      last_name: 'smith',
    },
    changed_by: {
      id: 2,
      first_name: 'tom',
      last_name: 'brown',
    },
  };

  render(<TagModal {...mockedProps} editTag={editTag} />);
  expect(screen.getByPlaceholderText(/name of your tag/i)).toHaveValue(
    editTag.name,
  );
});
