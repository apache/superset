import React from 'react';
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
    created_by: {},
  };

  render(<TagModal {...mockedProps} editTag={editTag} />);
  expect(screen.getByPlaceholderText(/name of your tag/i)).toHaveValue(
    editTag.name,
  );
});
