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

const mockXlsxRead = jest.fn();
const mockSheetToJson = jest.fn();
jest.mock('xlsx', () => ({
  __esModule: true,
  default: {
    read: (...args: unknown[]) => mockXlsxRead(...args),
    utils: {
      sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
    },
  },
}));

// Polyfill File.prototype.arrayBuffer for jsdom (not implemented)
if (typeof File.prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function (this: File) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
      reader.readAsArrayBuffer(this);
    });
  };
}

beforeEach(() => {
  mockXlsxRead.mockReset();
  mockSheetToJson.mockReset();
});

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  file: null,
  type: 'csv' as const,
};

function createCSVFile(content: BlobPart): File {
  return new File([content], 'test.csv', { type: 'text/csv' });
}

const encoder = new TextEncoder();

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
  const bufferSpy = jest.spyOn(File.prototype, 'arrayBuffer');
  bufferSpy.mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(() => resolve(encoder.encode('a,b\n1,2').buffer), 100),
      ),
  );

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  bufferSpy.mockRestore();
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
  const bufferSpy = jest.spyOn(File.prototype, 'arrayBuffer');
  bufferSpy.mockRejectedValueOnce(new Error('Read failed'));

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByText(/Read failed|Failed to parse file/),
    ).toBeInTheDocument();
  });

  bufferSpy.mockRestore();
});

test('keeps quoted delimiters, quotes and line breaks inside one CSV field', async () => {
  const file = createCSVFile(
    'name,note\n"Smith, Jane","She said ""hi""\nthen left"\nBob,plain',
  );

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByRole('cell', { name: 'Smith, Jane' }),
    ).toBeInTheDocument();
  });
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  expect(screen.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
  expect(
    screen.getByText(/She said "hi"/, { selector: 'td, td *' }),
  ).toBeInTheDocument();
});

test('strips a UTF-8 byte order mark from the first column name', async () => {
  const file = createCSVFile('\uFEFFid,name\n1,Alice');

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'id' }),
    ).toBeInTheDocument();
  });
  expect(screen.getByRole('columnheader', { name: 'id' }).textContent).toBe(
    'id',
  );
});

test('decodes non-UTF-8 CSV files as windows-1252', async () => {
  // "café" in latin-1: 0xE9 is not valid UTF-8 on its own.
  const bytes = new Uint8Array([...encoder.encode('word\ncaf'), 0xe9]);
  const file = createCSVFile(bytes);

  render(<DataPreviewModal {...defaultProps} file={file} type="csv" />);

  await waitFor(() => {
    expect(screen.getByRole('cell', { name: 'café' })).toBeInTheDocument();
  });
});

test('applies skip rows and header row like the uploader', async () => {
  const file = createCSVFile(
    'report title\n\nignored,row\nid,name\n1,Alice\n2,Bob',
  );

  render(
    <DataPreviewModal
      {...defaultProps}
      file={file}
      type="csv"
      skipRows={1}
      headerRow={1}
    />,
  );

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'id' }),
    ).toBeInTheDocument();
  });
  expect(
    screen.getByRole('columnheader', { name: 'name' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
  expect(screen.queryByText('report title')).not.toBeInTheDocument();
  expect(screen.queryByText('ignored')).not.toBeInTheDocument();
});

test('ignores a stale parse when the file changes mid-parse', async () => {
  const oldFile = createCSVFile('old_col\nold_value');
  const newFile = createCSVFile('new_col\nnew_value');
  let resolveOld: (buffer: ArrayBuffer) => void = () => {};
  const originalArrayBuffer = File.prototype.arrayBuffer;
  const bufferSpy = jest
    .spyOn(File.prototype, 'arrayBuffer')
    .mockImplementation(function (this: File) {
      if (this === oldFile) {
        return new Promise(resolve => {
          resolveOld = resolve;
        });
      }
      return originalArrayBuffer.call(this);
    });

  const { rerender } = render(
    <DataPreviewModal {...defaultProps} file={oldFile} type="csv" />,
  );
  rerender(<DataPreviewModal {...defaultProps} file={newFile} type="csv" />);

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'new_col' }),
    ).toBeInTheDocument();
  });
  resolveOld(encoder.encode('old_col\nold_value').buffer);
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(
    screen.getByRole('columnheader', { name: 'new_col' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('old_col')).not.toBeInTheDocument();

  bufferSpy.mockRestore();
});

test('previews the selected Excel sheet', async () => {
  const sheets = { First: { id: 'first' }, Second: { id: 'second' } };
  mockXlsxRead.mockReturnValue({
    SheetNames: ['First', 'Second'],
    Sheets: sheets,
  });
  mockSheetToJson.mockImplementation(sheet =>
    sheet === sheets.Second
      ? [
          ['city', 'population'],
          ['Lima', 10000000],
        ]
      : [['wrong_sheet'], ['x']],
  );
  const file = new File(['xlsx-bytes'], 'test.xlsx');

  render(
    <DataPreviewModal
      {...defaultProps}
      file={file}
      type="excel"
      sheetName="Second"
    />,
  );

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'city' }),
    ).toBeInTheDocument();
  });
  expect(screen.getByRole('cell', { name: 'Lima' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '10000000' })).toBeInTheDocument();
  expect(screen.queryByText('wrong_sheet')).not.toBeInTheDocument();
  expect(mockSheetToJson).toHaveBeenCalledWith(
    sheets.Second,
    expect.objectContaining({ header: 1 }),
  );
});

test('falls back to the first Excel sheet and applies header row', async () => {
  const sheets = { Only: { id: 'only' } };
  mockXlsxRead.mockReturnValue({ SheetNames: ['Only'], Sheets: sheets });
  mockSheetToJson.mockReturnValue([
    ['Quarterly report', ''],
    ['region', 'sales'],
    ['North', 42],
  ]);
  const file = new File(['xlsx-bytes'], 'test.xlsx');

  render(
    <DataPreviewModal
      {...defaultProps}
      file={file}
      type="excel"
      headerRow={1}
    />,
  );

  await waitFor(() => {
    expect(
      screen.getByRole('columnheader', { name: 'region' }),
    ).toBeInTheDocument();
  });
  expect(screen.getByRole('cell', { name: 'North' })).toBeInTheDocument();
  expect(screen.queryByText('Quarterly report')).not.toBeInTheDocument();
});
