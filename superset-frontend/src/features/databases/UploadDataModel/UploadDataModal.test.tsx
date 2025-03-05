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
import fetchMock from 'fetch-mock';
import UploadDataModal, {
  validateUploadFileExtension,
} from 'src/features/databases/UploadDataModel';
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { UploadFile } from 'antd/lib/upload/interface';

const csvProps = {
  show: true,
  onHide: () => {},
  allowedExtensions: ['csv', 'tsv'],
  type: 'csv',
};

const excelProps = {
  show: true,
  onHide: () => {},
  allowedExtensions: ['xls', 'xlsx'],
  type: 'excel',
};

const columnarProps = {
  show: true,
  onHide: () => {},
  allowedExtensions: ['parquet', 'zip'],
  type: 'columnar',
};

beforeEach(() => {
  fetchMock.post('glob:*api/v1/database/1/upload/', {});

  // 4 mocks below are not necessary
  fetchMock.post('glob:*api/v1/database/csv_metadata/', {});
  fetchMock.post('glob:*api/v1/database/excel_metadata/', {});
  fetchMock.post('glob:*api/v1/database/columnar_metadata/', {});
  fetchMock.post('glob:*api/v1/database/upload_metadata/', {});

  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:eq,value:!t)),page:0,page_size:100)',
    {
      result: [
        {
          id: 1,
          database_name: 'database1',
        },
        {
          id: 2,
          database_name: 'database2',
        },
      ],
    },
  );

  fetchMock.get('glob:*api/v1/database/*/catalogs/', {
    result: [],
  });

  fetchMock.get('glob:*api/v1/database/1/schemas/', {
    result: ['information_schema', 'public'],
  });

  fetchMock.get('glob:*api/v1/database/2/schemas/', {
    result: ['schema1', 'schema2'],
  });
});

afterEach(() => {
  fetchMock.restore();
});

test('CSV, renders the general information elements correctly', () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const cancelButton = screen.getByRole('button', {
    name: 'Cancel',
  });
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });
  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });

  const title = screen.getByRole('heading', {
    name: /csv upload/i,
  });
  const panel1 = screen.getByRole('heading', {
    name: /General information/i,
  });
  const panel2 = screen.getByRole('heading', {
    name: /file settings/i,
  });
  const panel3 = screen.getByRole('heading', {
    name: /columns/i,
  });
  const panel4 = screen.getByRole('heading', {
    name: /rows/i,
  });
  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  const selectDelimiter = screen.getByRole('combobox', {
    name: /choose a delimiter/i,
  });
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  const inputSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });

  const visibleComponents = [
    cancelButton,
    uploadButton,
    selectButton,
    title,
    panel1,
    panel2,
    panel3,
    panel4,
    selectDatabase,
    selectDelimiter,
    inputTableName,
    inputSchema,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Excel, renders the general information elements correctly', () => {
  render(<UploadDataModal {...excelProps} />, {
    useRedux: true,
  });

  const cancelButton = screen.getByRole('button', {
    name: 'Cancel',
  });
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });
  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });

  const title = screen.getByRole('heading', {
    name: /excel upload/i,
  });
  const missingTitle = screen.queryByRole('heading', {
    name: /csv upload/i,
  });
  expect(missingTitle).not.toBeInTheDocument();
  const panel1 = screen.getByRole('heading', {
    name: /General information/i,
  });
  const panel2 = screen.getByRole('heading', {
    name: /file settings/i,
  });
  const panel3 = screen.getByRole('heading', {
    name: /columns/i,
  });
  const panel4 = screen.getByRole('heading', {
    name: /rows/i,
  });
  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  const selectDelimiter = screen.queryByRole('combobox', {
    name: /choose a delimiter/i,
  });
  expect(selectDelimiter).not.toBeInTheDocument();
  const selectSheetName = screen.getByRole('combobox', {
    name: /choose sheet name/i,
  });
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  const inputSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });

  const visibleComponents = [
    cancelButton,
    uploadButton,
    selectButton,
    title,
    panel1,
    panel2,
    panel3,
    panel4,
    selectDatabase,
    selectSheetName,
    inputTableName,
    inputSchema,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Columnar, renders the general information elements correctly', () => {
  render(<UploadDataModal {...columnarProps} />, {
    useRedux: true,
  });

  const cancelButton = screen.getByRole('button', {
    name: 'Cancel',
  });
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });
  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });

  const title = screen.getByRole('heading', {
    name: /columnar upload/i,
  });
  const missingTitle = screen.queryByRole('heading', {
    name: /csv upload/i,
  });
  expect(missingTitle).not.toBeInTheDocument();
  const panel1 = screen.getByRole('heading', {
    name: /General information/i,
  });
  const panel2 = screen.getByRole('heading', {
    name: /file settings/i,
  });
  const panel3 = screen.getByRole('heading', {
    name: /columns/i,
  });
  const panel4 = screen.queryByRole('heading', {
    name: /rows/i,
  });
  expect(panel4).not.toBeInTheDocument();

  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  const selectDelimiter = screen.queryByRole('combobox', {
    name: /choose a delimiter/i,
  });
  expect(selectDelimiter).not.toBeInTheDocument();

  const selectSheetName = screen.queryByRole('combobox', {
    name: /choose sheet name/i,
  });
  expect(selectSheetName).not.toBeInTheDocument();
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  const inputSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });

  const visibleComponents = [
    cancelButton,
    uploadButton,
    selectButton,
    title,
    panel1,
    panel2,
    panel3,
    selectDatabase,
    inputTableName,
    inputSchema,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('CSV, renders the file settings elements correctly', () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  expect(screen.queryByText('If Table Already Exists')).not.toBeInTheDocument();
  const panelHeader = screen.getByRole('heading', {
    name: /file settings/i,
  });
  userEvent.click(panelHeader);
  const selectTableAlreadyExists = screen.getByRole('combobox', {
    name: /choose already exists/i,
  });
  const switchSkipInitialSpace = screen.getByTestId('skipInitialSpace');
  const switchSkipBlankLines = screen.getByTestId('skipBlankLines');
  const switchDayFirst = screen.getByTestId('dayFirst');
  const inputDecimalCharacter = screen.getByRole('textbox', {
    name: /decimal character/i,
  });
  const selectColumnsDates = screen.getByRole('combobox', {
    name: /choose columns to be parsed as dates/i,
  });
  const selectNullValues = screen.getByRole('combobox', {
    name: /null values/i,
  });
  userEvent.click(selectColumnsDates);
  userEvent.click(selectNullValues);
  const visibleComponents = [
    selectTableAlreadyExists,
    switchSkipInitialSpace,
    switchDayFirst,
    switchSkipBlankLines,
    inputDecimalCharacter,
    selectNullValues,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Excel, renders the file settings elements correctly', () => {
  render(<UploadDataModal {...excelProps} />, {
    useRedux: true,
  });

  expect(screen.queryByText('If Table Already Exists')).not.toBeInTheDocument();
  const panelHeader = screen.getByRole('heading', {
    name: /file settings/i,
  });
  userEvent.click(panelHeader);
  const selectTableAlreadyExists = screen.getByRole('combobox', {
    name: /choose already exists/i,
  });
  const inputDecimalCharacter = screen.getByRole('textbox', {
    name: /decimal character/i,
  });
  const selectColumnsDates = screen.getByRole('combobox', {
    name: /choose columns to be parsed as dates/i,
  });
  const selectNullValues = screen.getByRole('combobox', {
    name: /null values/i,
  });
  userEvent.click(selectColumnsDates);
  userEvent.click(selectNullValues);

  const switchSkipInitialSpace = screen.queryByText('skipInitialSpace');
  expect(switchSkipInitialSpace).not.toBeInTheDocument();
  const switchSkipBlankLines = screen.queryByText('skipBlankLines');
  expect(switchSkipBlankLines).not.toBeInTheDocument();
  const switchDayFirst = screen.queryByText('dayFirst');
  expect(switchDayFirst).not.toBeInTheDocument();

  const visibleComponents = [
    selectTableAlreadyExists,
    inputDecimalCharacter,
    selectNullValues,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Columnar, renders the file settings elements correctly', () => {
  render(<UploadDataModal {...columnarProps} />, {
    useRedux: true,
  });

  expect(screen.queryByText('If Table Already Exists')).not.toBeInTheDocument();
  const panelHeader = screen.getByRole('heading', {
    name: /file settings/i,
  });
  userEvent.click(panelHeader);
  const selectTableAlreadyExists = screen.getByRole('combobox', {
    name: /choose already exists/i,
  });
  const inputDecimalCharacter = screen.queryByRole('textbox', {
    name: /decimal character/i,
  });
  expect(inputDecimalCharacter).not.toBeInTheDocument();
  const selectColumnsDates = screen.queryByRole('combobox', {
    name: /choose columns to be parsed as dates/i,
  });
  expect(selectColumnsDates).not.toBeInTheDocument();
  const selectNullValues = screen.queryByRole('combobox', {
    name: /null values/i,
  });
  expect(selectNullValues).not.toBeInTheDocument();

  const switchSkipInitialSpace = screen.queryByText('skipInitialSpace');
  expect(switchSkipInitialSpace).not.toBeInTheDocument();
  const switchSkipBlankLines = screen.queryByText('skipBlankLines');
  expect(switchSkipBlankLines).not.toBeInTheDocument();
  const switchDayFirst = screen.queryByText('dayFirst');
  expect(switchDayFirst).not.toBeInTheDocument();

  const visibleComponents = [selectTableAlreadyExists];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('CSV, renders the columns elements correctly', () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const panelHeader = screen.getByRole('heading', {
    name: /columns/i,
  });
  userEvent.click(panelHeader);
  const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
  userEvent.click(switchDataFrameIndex);
  const selectIndexColumn = screen.getByRole('combobox', {
    name: /Choose index column/i,
  });
  const inputColumnLabels = screen.getByRole('textbox', {
    name: /Index label/i,
  });
  const selectColumnsToRead = screen.getByRole('combobox', {
    name: /Choose columns to read/i,
  });
  const inputColumnDataTypes = screen.getByRole('textbox', {
    name: /Column data types/i,
  });
  userEvent.click(selectColumnsToRead);

  const visibleComponents = [
    selectIndexColumn,
    switchDataFrameIndex,
    inputColumnLabels,
    selectColumnsToRead,
    inputColumnDataTypes,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Excel, renders the columns elements correctly', () => {
  render(<UploadDataModal {...excelProps} />, {
    useRedux: true,
  });

  const panelHeader = screen.getByRole('heading', {
    name: /columns/i,
  });
  userEvent.click(panelHeader);
  const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
  userEvent.click(switchDataFrameIndex);
  const selectIndexColumn = screen.getByRole('combobox', {
    name: /Choose index column/i,
  });
  const inputIndexLabel = screen.getByRole('textbox', {
    name: /Index label/i,
  });
  const selectColumnsToRead = screen.getByRole('combobox', {
    name: /Choose columns to read/i,
  });
  userEvent.click(selectColumnsToRead);

  const columnDataTypes = screen.queryByRole('textbox', {
    name: /Column data types/i,
  });

  expect(columnDataTypes).not.toBeInTheDocument();

  const visibleComponents = [
    selectIndexColumn,
    switchDataFrameIndex,
    inputIndexLabel,
    selectColumnsToRead,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Columnar, renders the columns elements correctly', () => {
  render(<UploadDataModal {...columnarProps} />, {
    useRedux: true,
  });

  const panelHeader = screen.getByRole('heading', {
    name: /columns/i,
  });
  userEvent.click(panelHeader);
  const selectIndexColumn = screen.queryByRole('combobox', {
    name: /Choose index column/i,
  });
  expect(selectIndexColumn).not.toBeInTheDocument();
  const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
  userEvent.click(switchDataFrameIndex);
  const inputIndexLabel = screen.getByRole('textbox', {
    name: /Index label/i,
  });
  const selectColumnsToRead = screen.getByRole('combobox', {
    name: /Choose columns to read/i,
  });
  userEvent.click(selectColumnsToRead);

  const columnDataTypes = screen.queryByRole('textbox', {
    name: /Column data types/i,
  });
  expect(columnDataTypes).not.toBeInTheDocument();

  const visibleComponents = [
    switchDataFrameIndex,
    inputIndexLabel,
    selectColumnsToRead,
  ];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('renders the rows elements correctly', () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const panelHeader = screen.getByRole('heading', {
    name: /rows/i,
  });
  userEvent.click(panelHeader);
  const inputHeaderRow = screen.getByRole('spinbutton', {
    name: /header row/i,
  });
  const inputRowsToRead = screen.getByRole('spinbutton', {
    name: /rows to read/i,
  });
  const inputSkipRows = screen.getByRole('spinbutton', {
    name: /skip rows/i,
  });

  const visibleComponents = [inputHeaderRow, inputRowsToRead, inputSkipRows];
  visibleComponents.forEach(component => {
    expect(component).toBeInTheDocument();
  });
});

test('Columnar, does not render the rows', () => {
  render(<UploadDataModal {...columnarProps} />, {
    useRedux: true,
  });

  const panelHeader = screen.queryByRole('heading', {
    name: /rows/i,
  });
  expect(panelHeader).not.toBeInTheDocument();
});

test('database and schema are correctly populated', async () => {
  jest.setTimeout(10000);
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  const selectSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });

  userEvent.click(selectDatabase);

  await waitFor(() => screen.getByText('database1'));
  await waitFor(() => screen.getByText('database2'));

  screen.getByText('database1').click();
  userEvent.click(selectSchema);
  // make sure the schemas for database1 are displayed
  await waitFor(() => screen.getAllByText('information_schema'));
  await waitFor(() => screen.getAllByText('public'));

  screen.getByText('database2').click();
  userEvent.click(selectSchema);
  // make sure the schemas for database2 are displayed
  await waitFor(() => screen.getAllByText('schema1'));
  await waitFor(() => screen.getAllByText('schema2'));
});

test('form without required fields', async () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });

  // Submit form without filling any fields
  userEvent.click(uploadButton);

  await waitFor(() => screen.getByText('Uploading a file is required'));
  await waitFor(() => screen.getByText('Selecting a database is required'));
  await waitFor(() => screen.getByText('Table name is required'));
});

test('CSV form post', async () => {
  render(<UploadDataModal {...csvProps} />, {
    useRedux: true,
  });

  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });
  userEvent.click(selectButton);

  // Select a file from the file dialog
  const file = new File(['test'], 'test.csv', { type: 'text' });
  const inputElement = screen.getByTestId('model-file-input');

  if (inputElement) {
    userEvent.upload(inputElement as HTMLElement, file);
  }

  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  userEvent.click(selectDatabase);
  await screen.findByText('database1');
  await screen.findByText('database2');

  screen.getByText('database1').click();
  const selectSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });
  userEvent.click(selectSchema);
  await screen.findAllByText('public');
  screen.getAllByText('public')[1].click();

  // Fill out form fields
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  userEvent.type(inputTableName, 'table1');
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });

  userEvent.click(uploadButton);
  await waitFor(() => fetchMock.called('glob:*api/v1/database/1/upload/'));

  // Get the matching fetch calls made
  const matchingCalls = fetchMock.calls('glob:*api/v1/database/1/upload/');
  expect(matchingCalls).toHaveLength(1);
  const [, options] = matchingCalls[0];
  const formData = options?.body as FormData;
  expect(formData.get('type')).toBe('csv');
  expect(formData.get('table_name')).toBe('table1');
  expect(formData.get('schema')).toBe('public');
  expect(formData.get('table_name')).toBe('table1');
  const fileData = formData.get('file') as File;
  expect(fileData.name).toBe('test.csv');
});

test('Excel form post', async () => {
  render(<UploadDataModal {...excelProps} />, {
    useRedux: true,
  });

  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });
  userEvent.click(selectButton);

  // Select a file from the file dialog
  const file = new File(['test'], 'test.xls', { type: 'text' });
  const inputElement = screen.getByTestId('model-file-input');

  if (inputElement) {
    userEvent.upload(inputElement as HTMLElement, file);
  }

  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  userEvent.click(selectDatabase);
  await screen.findByText('database1');
  await screen.findByText('database2');

  screen.getByText('database1').click();
  const selectSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });
  userEvent.click(selectSchema);
  await screen.findAllByText('public');
  screen.getAllByText('public')[1].click();

  // Fill out form fields
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  userEvent.type(inputTableName, 'table1');
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });

  userEvent.click(uploadButton);
  await waitFor(() => fetchMock.called('glob:*api/v1/database/1/upload/'));

  // Get the matching fetch calls made
  const matchingCalls = fetchMock.calls('glob:*api/v1/database/1/upload/');
  expect(matchingCalls).toHaveLength(1);
  const [, options] = matchingCalls[0];
  const formData = options?.body as FormData;
  expect(formData.get('type')).toBe('excel');
  expect(formData.get('table_name')).toBe('table1');
  expect(formData.get('schema')).toBe('public');
  expect(formData.get('table_name')).toBe('table1');
  const fileData = formData.get('file') as File;
  expect(fileData.name).toBe('test.xls');
});

test('Columnar form post', async () => {
  render(<UploadDataModal {...columnarProps} />, {
    useRedux: true,
  });

  const selectButton = screen.getByRole('button', {
    name: 'Select',
  });
  userEvent.click(selectButton);

  // Select a file from the file dialog
  const file = new File(['test'], 'test.parquet', { type: 'text' });
  const inputElement = screen.getByTestId('model-file-input');

  if (inputElement) {
    userEvent.upload(inputElement as HTMLElement, file);
  }

  const selectDatabase = screen.getByRole('combobox', {
    name: /select a database/i,
  });
  userEvent.click(selectDatabase);
  await screen.findByText('database1');
  await screen.findByText('database2');

  screen.getByText('database1').click();
  const selectSchema = screen.getByRole('combobox', {
    name: /schema/i,
  });
  userEvent.click(selectSchema);
  await screen.findAllByText('public');
  screen.getAllByText('public')[1].click();

  // Fill out form fields
  const inputTableName = screen.getByRole('textbox', {
    name: /table name/i,
  });
  userEvent.type(inputTableName, 'table1');
  const uploadButton = screen.getByRole('button', {
    name: 'Upload',
  });

  userEvent.click(uploadButton);
  await waitFor(() => fetchMock.called('glob:*api/v1/database/1/upload/'));

  // Get the matching fetch calls made
  const matchingCalls = fetchMock.calls('glob:*api/v1/database/1/upload/');
  expect(matchingCalls).toHaveLength(1);
  const [, options] = matchingCalls[0];
  const formData = options?.body as FormData;
  expect(formData.get('type')).toBe('columnar');
  expect(formData.get('table_name')).toBe('table1');
  expect(formData.get('schema')).toBe('public');
  expect(formData.get('table_name')).toBe('table1');
  const fileData = formData.get('file') as File;
  expect(fileData.name).toBe('test.parquet');
});

test('CSV, validate file extension returns false', () => {
  const invalidFileNames = ['out', 'out.exe', 'out.csv.exe', '.csv', 'out.xls'];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['csv', 'tsv'])).toBe(false);
  });
});

test('Excel, validate file extension returns false', () => {
  const invalidFileNames = ['out', 'out.exe', 'out.xls.exe', '.csv', 'out.csv'];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['xls', 'xlsx'])).toBe(false);
  });
});

test('Columnar, validate file extension returns false', () => {
  const invalidFileNames = [
    'out',
    'out.exe',
    'out.parquet.exe',
    '.parquet',
    'out.excel',
  ];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['parquet', 'zip'])).toBe(false);
  });
});

test('CSV, validate file extension returns true', () => {
  const invalidFileNames = ['out.csv', 'out.tsv', 'out.exe.csv', 'out a.csv'];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['csv', 'tsv'])).toBe(true);
  });
});

test('Excel, validate file extension returns true', () => {
  const invalidFileNames = ['out.xls', 'out.xlsx', 'out.exe.xls', 'out a.xls'];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['xls', 'xlsx'])).toBe(true);
  });
});

test('Columnar, validate file extension returns true', () => {
  const invalidFileNames = [
    'out.parquet',
    'out.zip',
    'out.exe.zip',
    'out a.parquet',
  ];
  invalidFileNames.forEach(fileName => {
    const file: UploadFile<any> = {
      name: fileName,
      uid: 'xp',
      size: 100,
      type: 'text/csv',
    };
    expect(validateUploadFileExtension(file, ['parquet', 'zip'])).toBe(true);
  });
});
