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
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { DataPreviewModal } from './DataPreviewModal';

// Polyfill File.prototype.text for jsdom (not implemented)
if (typeof File.prototype.text !== 'function') {
  File.prototype.text = function (this: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
      reader.readAsText(this);
    });
  };
}

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  file: null,
  type: 'csv' as const,
};

function createCSVFile(content: string): File {
  return new File([content], 'test.csv', { type: 'text/csv' });
}

test('renders modal with Data preview title when show is true', () => {
  render(<DataPreviewModal {...defaultProps} />);

  expect(screen.getByText('Data preview')).toBeInTheDocument();
});

test('shows no data to preview when file is null', async () => {
  render(<DataPreviewModal {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('No data to preview')).toBeInTheDocument();
  });
});

test('parses CSV and displays data in table', async () => {
  const csvContent = 'name,age,city\nAlice,30,NYC\nBob,25,Boston';
  const file = createCSVFile(csvContent);

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'name' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'age' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'city' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'NYC' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '25' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Boston' })).toBeInTheDocument();
  });
});

test('uses custom delimiter for CSV parsing', async () => {
  const csvContent = 'name;age;city\nAlice;30;NYC';
  const file = createCSVFile(csvContent);

  render(
    <DataPreviewModal {...defaultProps} file={file} type="csv" delimiter=";" />,
  );

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'name' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
  });
});

test('shows error for columnar type', async () => {
  const file = createCSVFile('col1\nval1');

  render(<DataPreviewModal {...defaultProps} file={file} type="columnar" />);

  await waitFor(() => {
    expect(
      screen.getByText('Data preview is not available for Parquet files.'),
    ).toBeInTheDocument();
  });
});

test('shows No data to preview for empty CSV', async () => {
  const file = createCSVFile('');

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(screen.getByText('No data to preview')).toBeInTheDocument();
  });
});

test('shows Loading while parsing', async () => {
  const file = createCSVFile('a,b\n1,2');
  const textSpy = jest.spyOn(File.prototype, 'text');
  textSpy.mockImplementation(
    () => new Promise(resolve => setTimeout(() => resolve('a,b\n1,2'), 100)),
  );

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  textSpy.mockRestore();
});

test('calls onHide when modal close button is clicked', async () => {
  const onHide = jest.fn();
  render(
    <DataPreviewModal
      {...defaultProps}
      onHide={onHide}
      file={createCSVFile('a,b\n1,2')}
      type="csv"
    />,
  );

  await waitFor(() => {
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
  });

  const closeButton = screen.getByTestId('close-modal-btn');
  await userEvent.click(closeButton);

  expect(onHide).toHaveBeenCalledTimes(1);
});

test('shows error message when CSV parse fails', async () => {
  const file = new File(['invalid'], 'test.csv', { type: 'text/csv' });
  const textSpy = jest.spyOn(File.prototype, 'text');
  textSpy.mockRejectedValueOnce(new Error('Read failed'));

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByText(/Read failed|Failed to parse file/),
    ).toBeInTheDocument();
  });

  textSpy.mockRestore();
});
