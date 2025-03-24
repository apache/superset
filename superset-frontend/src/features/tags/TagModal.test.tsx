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
import TagModal from 'src/features/tags/TagModal';
import fetchMock from 'fetch-mock';
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
