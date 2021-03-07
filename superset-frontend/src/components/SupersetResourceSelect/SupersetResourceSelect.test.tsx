import React from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import SupersetResourceSelect from '.';

const onChange = jest.fn();
const mockedProps = {
  resource: 'dataset',
  searchColumn: 'table_name',
  isMulti: false,
  onError: () => {},
  onChange,
};

fetchMock.get('glob:*/api/v1/dataset/?q=*', {});

test('should render', () => {
  const { container } = render(<SupersetResourceSelect {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the Select... placeholder', () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  expect(screen.getByText('Select...')).toBeInTheDocument();
});

test('should render the Loading... message', () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('should render the No options message', async () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  await waitFor(() => {
    expect(screen.getByText('No options')).toBeInTheDocument();
  });
});

test('should render the typed text', async () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  userEvent.type(select, 'typed text');
  expect(screen.getByText('typed text')).toBeInTheDocument();
});
