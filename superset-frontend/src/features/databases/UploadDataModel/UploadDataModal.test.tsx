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
  fireEvent,
} from 'spec/helpers/testing-library';

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

// Helper function to setup common mocks
const setupMocks = () => {
  fetchMock.post('glob:*api/v1/database/1/upload/', {});
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

  fetchMock.get('glob:*api/v1/database/1/schemas/?q=(upload_allowed:!t)', {
    result: ['information_schema', 'public'],
  });

  fetchMock.get('glob:*api/v1/database/2/schemas/?q=(upload_allowed:!t)', {
    result: ['schema1', 'schema2'],
  });
};

// Set timeout for all tests in this file to 30 seconds
jest.setTimeout(30000);

beforeEach(() => {
  setupMocks();
});

afterEach(() => {
  fetchMock.restore();
});

// Helper function to get common elements
const getCommonElements = () => ({
  cancelButton: screen.getByRole('button', { name: 'Cancel' }),
  uploadButton: screen.getByRole('button', { name: 'Upload' }),
  selectButton: screen.getByRole('button', { name: 'Select' }),
  panel1: screen.getByText(/General information/i, { selector: 'strong' }),
  panel2: screen.getByText(/file settings/i, { selector: 'strong' }),
  panel3: screen.getByText(/columns/i, { selector: 'strong' }),
  selectDatabase: screen.getByRole('combobox', { name: /select a database/i }),
  inputTableName: screen.getByRole('textbox', { name: /table name/i }),
  inputSchema: screen.getByRole('combobox', { name: /schema/i }),
});

// Helper function to check element visibility
const expectElementsVisible = (elements: any[]) => {
  elements.forEach((element: any) => {
    expect(element).toBeInTheDocument();
  });
};

// Helper function to check element absence
const expectElementsNotVisible = (elements: any[]) => {
  elements.forEach((element: any) => {
    expect(element).not.toBeInTheDocument();
  });
};

describe('UploadDataModal - General Information Elements', () => {
  test('CSV renders correctly', () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    const common = getCommonElements();
    const title = screen.getByRole('heading', { name: /csv upload/i });
    const panel4 = screen.getByText(/rows/i);
    const selectDelimiter = screen.getByRole('combobox', {
      name: /choose a delimiter/i,
    });

    expectElementsVisible([
      common.cancelButton,
      common.uploadButton,
      common.selectButton,
      title,
      common.panel1,
      common.panel2,
      common.panel3,
      panel4,
      common.selectDatabase,
      selectDelimiter,
      common.inputTableName,
      common.inputSchema,
    ]);
  });

  test('Excel renders correctly', () => {
    render(<UploadDataModal {...excelProps} />, { useRedux: true });

    const common = getCommonElements();
    const title = screen.getByRole('heading', { name: /excel upload/i });
    const panel4 = screen.getByText(/rows/i);
    const selectSheetName = screen.getByRole('combobox', {
      name: /choose sheet name/i,
    });

    expectElementsVisible([
      common.cancelButton,
      common.uploadButton,
      common.selectButton,
      title,
      common.panel1,
      common.panel2,
      common.panel3,
      panel4,
      common.selectDatabase,
      selectSheetName,
      common.inputTableName,
      common.inputSchema,
    ]);

    // Check elements that should NOT be visible
    expect(screen.queryByText(/csv upload/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /choose a delimiter/i }),
    ).not.toBeInTheDocument();
  });

  test('Columnar renders correctly', () => {
    render(<UploadDataModal {...columnarProps} />, { useRedux: true });

    const common = getCommonElements();
    const title = screen.getByRole('heading', { name: /columnar upload/i });

    expectElementsVisible([
      common.cancelButton,
      common.uploadButton,
      common.selectButton,
      title,
      common.panel1,
      common.panel2,
      common.panel3,
      common.selectDatabase,
      common.inputTableName,
      common.inputSchema,
    ]);

    // Check elements that should NOT be visible
    expectElementsNotVisible([
      screen.queryByText(/csv upload/i),
      screen.queryByText(/rows/i),
      screen.queryByRole('combobox', { name: /choose a delimiter/i }),
      screen.queryByRole('combobox', { name: /choose sheet name/i }),
    ]);
  });
});

describe('UploadDataModal - File Settings Elements', () => {
  const openFileSettings = async () => {
    const panelHeader = screen.getByText(/file settings/i);
    await userEvent.click(panelHeader);
  };

  test('CSV file settings render correctly', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    expect(
      screen.queryByText('If Table Already Exists'),
    ).not.toBeInTheDocument();
    await openFileSettings();

    const elements = [
      screen.getByRole('combobox', { name: /choose already exists/i }),
      screen.getByTestId('skipInitialSpace'),
      screen.getByTestId('skipBlankLines'),
      screen.getByTestId('dayFirst'),
      screen.getByRole('textbox', { name: /decimal character/i }),
      screen.getByRole('combobox', { name: /null values/i }),
    ];

    expectElementsVisible(elements);
  });

  test('Excel file settings render correctly', async () => {
    render(<UploadDataModal {...excelProps} />, { useRedux: true });

    expect(
      screen.queryByText('If Table Already Exists'),
    ).not.toBeInTheDocument();
    await openFileSettings();

    const visibleElements = [
      screen.getByRole('combobox', { name: /choose already exists/i }),
      screen.getByRole('textbox', { name: /decimal character/i }),
      screen.getByRole('combobox', { name: /null values/i }),
    ];

    expectElementsVisible(visibleElements);

    // Check elements that should NOT be visible
    expectElementsNotVisible([
      screen.queryByText('skipInitialSpace'),
      screen.queryByText('skipBlankLines'),
      screen.queryByText('dayFirst'),
    ]);
  });

  test('Columnar file settings render correctly', async () => {
    render(<UploadDataModal {...columnarProps} />, { useRedux: true });

    expect(
      screen.queryByText('If Table Already Exists'),
    ).not.toBeInTheDocument();
    await openFileSettings();

    const visibleElements = [
      screen.getByRole('combobox', { name: /choose already exists/i }),
    ];

    expectElementsVisible(visibleElements);

    // Check elements that should NOT be visible
    expectElementsNotVisible([
      screen.queryByRole('textbox', { name: /decimal character/i }),
      screen.queryByRole('combobox', {
        name: /choose columns to be parsed as dates/i,
      }),
      screen.queryByRole('combobox', { name: /null values/i }),
      screen.queryByText('skipInitialSpace'),
      screen.queryByText('skipBlankLines'),
      screen.queryByText('dayFirst'),
    ]);
  });
});

describe('UploadDataModal - Columns Elements', () => {
  const openColumns = async () => {
    const panelHeader = screen.getByText(/columns/i, { selector: 'strong' });
    await userEvent.click(panelHeader);
  };

  test('CSV columns render correctly', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    await openColumns();
    const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
    await userEvent.click(switchDataFrameIndex);

    const elements = [
      screen.getByRole('combobox', { name: /Choose index column/i }),
      switchDataFrameIndex,
      screen.getByRole('textbox', { name: /Index label/i }),
      screen.getByRole('combobox', { name: /Choose columns to read/i }),
      screen.getByRole('textbox', { name: /Column data types/i }),
    ];

    expectElementsVisible(elements);
  });

  test('Excel columns render correctly', async () => {
    render(<UploadDataModal {...excelProps} />, { useRedux: true });

    await openColumns();
    const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
    await userEvent.click(switchDataFrameIndex);

    const visibleElements = [
      screen.getByRole('combobox', { name: /Choose index column/i }),
      switchDataFrameIndex,
      screen.getByRole('textbox', { name: /Index label/i }),
      screen.getByRole('combobox', { name: /Choose columns to read/i }),
    ];

    expectElementsVisible(visibleElements);

    // Check elements that should NOT be visible
    expect(
      screen.queryByRole('textbox', { name: /Column data types/i }),
    ).not.toBeInTheDocument();
  });

  test('Columnar columns render correctly', async () => {
    render(<UploadDataModal {...columnarProps} />, { useRedux: true });

    await openColumns();
    const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
    await userEvent.click(switchDataFrameIndex);

    const visibleElements = [
      switchDataFrameIndex,
      screen.getByRole('textbox', { name: /Index label/i }),
      screen.getByRole('combobox', { name: /Choose columns to read/i }),
    ];

    expectElementsVisible(visibleElements);

    // Check elements that should NOT be visible
    expectElementsNotVisible([
      screen.queryByRole('combobox', { name: /Choose index column/i }),
      screen.queryByRole('textbox', { name: /Column data types/i }),
    ]);
  });
});

describe('UploadDataModal - Rows Elements', () => {
  test('CSV/Excel rows render correctly', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    const panelHeader = screen.getByText(/rows/i);
    await userEvent.click(panelHeader);

    const elements = [
      screen.getByRole('spinbutton', { name: /header row/i }),
      screen.getByRole('spinbutton', { name: /rows to read/i }),
      screen.getByRole('spinbutton', { name: /skip rows/i }),
    ];

    expectElementsVisible(elements);
  });

  test('Columnar does not render rows', () => {
    render(<UploadDataModal {...columnarProps} />, { useRedux: true });

    const panelHeader = screen.queryByText(/rows/i);
    expect(panelHeader).not.toBeInTheDocument();
  });
});

describe('UploadDataModal - Database and Schema Population', () => {
  test('database and schema are correctly populated', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    const selectDatabase = screen.getByRole('combobox', {
      name: /select a database/i,
    });
    const selectSchema = screen.getByRole('combobox', { name: /schema/i });

    // Test database selection
    await userEvent.click(selectDatabase);
    await waitFor(() => screen.getByText('database1'));
    await waitFor(() => screen.getByText('database2'));

    // Select database1 and check schemas
    await userEvent.click(screen.getByText('database1'));
    await userEvent.click(selectSchema);
    await waitFor(() => screen.getAllByText('information_schema'));
    await waitFor(() => screen.getAllByText('public'));

    // Switch to database2 and check schemas
    await userEvent.click(selectDatabase);
    await userEvent.click(screen.getByText('database2'));
    await userEvent.click(selectSchema);
    await waitFor(() => screen.getAllByText('schema1'));
    await waitFor(() => screen.getAllByText('schema2'));
  }, 60000);
});

describe('UploadDataModal - Form Validation', () => {
  test('form validation without required fields', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(
        screen.getByText('Uploading a file is required'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Selecting a database is required'),
      ).toBeInTheDocument();
      expect(screen.getByText('Table name is required')).toBeInTheDocument();
    });
  });
});

describe('UploadDataModal - Form Submission', () => {
  // Helper function to fill out form
  const fillForm = async (
    fileType: string,
    fileName: string,
    mimeType = 'text/csv',
  ) => {
    const selectButton = screen.getByRole('button', { name: 'Select' });
    await userEvent.click(selectButton);

    const file = new File(['test'], fileName, { type: mimeType });
    const inputElement = screen.getByTestId('model-file-input');
    fireEvent.change(inputElement, { target: { files: [file] } });

    const selectDatabase = screen.getByRole('combobox', {
      name: /select a database/i,
    });
    await userEvent.click(selectDatabase);

    await waitFor(() => screen.getByText('database1'));
    await userEvent.click(screen.getByText('database1'));

    const selectSchema = screen.getByRole('combobox', { name: /schema/i });
    await userEvent.click(selectSchema);

    await waitFor(() => screen.getAllByText('public'));
    await userEvent.click(screen.getAllByText('public')[1]);

    const inputTableName = screen.getByRole('textbox', { name: /table name/i });
    await userEvent.type(inputTableName, 'table1');

    const uploadButton = screen.getByRole('button', { name: 'Upload' });
    await userEvent.click(uploadButton);

    await waitFor(() => fetchMock.called('glob:*api/v1/database/1/upload/'), {
      timeout: 10000,
    });
    return fetchMock.calls('glob:*api/v1/database/1/upload/')[0];
  };

  test('CSV form submission', async () => {
    render(<UploadDataModal {...csvProps} />, { useRedux: true });

    const [, options] = await fillForm('csv', 'test.csv');
    const formData = options?.body as FormData;

    expect(formData.get('type')).toBe('csv');
    expect(formData.get('table_name')).toBe('table1');
    expect(formData.get('schema')).toBe('public');
    expect((formData.get('file') as File).name).toBe('test.csv');
  });

  test('Excel form submission', async () => {
    render(<UploadDataModal {...excelProps} />, { useRedux: true });

    const [, options] = await fillForm('excel', 'test.xls', 'text');
    const formData = options?.body as FormData;

    expect(formData.get('type')).toBe('excel');
    expect(formData.get('table_name')).toBe('table1');
    expect(formData.get('schema')).toBe('public');
    expect((formData.get('file') as File).name).toBe('test.xls');
  });

  test('Columnar form submission', async () => {
    render(<UploadDataModal {...columnarProps} />, { useRedux: true });

    const [, options] = await fillForm('columnar', 'test.parquet', 'text');
    const formData = options?.body as FormData;

    expect(formData.get('type')).toBe('columnar');
    expect(formData.get('table_name')).toBe('table1');
    expect(formData.get('schema')).toBe('public');
    expect((formData.get('file') as File).name).toBe('test.parquet');
  }, 60000);
});

describe('File Extension Validation', () => {
  const createTestFile = (fileName: string) => ({
    name: fileName,
    uid: 'xp',
    size: 100,
    type: 'text/csv',
  });

  describe('CSV validation', () => {
    test('returns false for invalid extensions', () => {
      const invalidFiles = ['out', 'out.exe', 'out.csv.exe', '.csv', 'out.xls'];
      invalidFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), ['csv', 'tsv']),
        ).toBe(false);
      });
    });

    test('returns true for valid extensions', () => {
      const validFiles = ['out.csv', 'out.tsv', 'out.exe.csv', 'out a.csv'];
      validFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), ['csv', 'tsv']),
        ).toBe(true);
      });
    });
  });

  describe('Excel validation', () => {
    test('returns false for invalid extensions', () => {
      const invalidFiles = ['out', 'out.exe', 'out.xls.exe', '.csv', 'out.csv'];
      invalidFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), [
            'xls',
            'xlsx',
          ]),
        ).toBe(false);
      });
    });

    test('returns true for valid extensions', () => {
      const validFiles = ['out.xls', 'out.xlsx', 'out.exe.xls', 'out a.xls'];
      validFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), [
            'xls',
            'xlsx',
          ]),
        ).toBe(true);
      });
    });
  });

  describe('Columnar validation', () => {
    test('returns false for invalid extensions', () => {
      const invalidFiles = [
        'out',
        'out.exe',
        'out.parquet.exe',
        '.parquet',
        'out.excel',
      ];
      invalidFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), [
            'parquet',
            'zip',
          ]),
        ).toBe(false);
      });
    });

    test('returns true for valid extensions', () => {
      const validFiles = [
        'out.parquet',
        'out.zip',
        'out.exe.zip',
        'out a.parquet',
      ];
      validFiles.forEach(fileName => {
        expect(
          validateUploadFileExtension(createTestFile(fileName), [
            'parquet',
            'zip',
          ]),
        ).toBe(true);
      });
    });
  });
});

describe('UploadDataModal Collapse Tabs', () => {
  it('renders the collaps tab CSV correctly and resets to default tab after closing', async () => {
    const { rerender } = render(<UploadDataModal {...csvProps} />, {
      useRedux: true,
    });
    const generalInfoTab = screen.getByRole('tab', {
      name: /expanded General information/i,
    });
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
    const fileSettingsTab = screen.getByRole('tab', {
      name: /collapsed File settings/i,
    });
    await userEvent.click(fileSettingsTab);
    await waitFor(() => {
      expect(fileSettingsTab).toHaveAttribute('aria-expanded', 'true');
    });
    rerender(<UploadDataModal {...csvProps} show={false} />);
    rerender(<UploadDataModal {...csvProps} />);
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the collaps tab Excel correctly and resets to default tab after closing', async () => {
    const { rerender } = render(<UploadDataModal {...excelProps} />, {
      useRedux: true,
    });
    const generalInfoTab = screen.getByRole('tab', {
      name: /expanded General information/i,
    });
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
    const fileSettingsTab = screen.getByRole('tab', {
      name: /collapsed File settings/i,
    });
    await userEvent.click(fileSettingsTab);
    await waitFor(() => {
      expect(fileSettingsTab).toHaveAttribute('aria-expanded', 'true');
    });
    rerender(<UploadDataModal {...excelProps} show={false} />);
    rerender(<UploadDataModal {...excelProps} />);
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the collaps tab Columnar correctly and resets to default tab after closing', async () => {
    const { rerender } = render(<UploadDataModal {...columnarProps} />, {
      useRedux: true,
    });
    const generalInfoTab = screen.getByRole('tab', {
      name: /expanded General information/i,
    });
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
    const fileSettingsTab = screen.getByRole('tab', {
      name: /collapsed File settings/i,
    });
    await userEvent.click(fileSettingsTab);
    await waitFor(() => {
      expect(fileSettingsTab).toHaveAttribute('aria-expanded', 'true');
    });
    rerender(<UploadDataModal {...columnarProps} show={false} />);
    rerender(<UploadDataModal {...columnarProps} />);
    expect(generalInfoTab).toHaveAttribute('aria-expanded', 'true');
  });
});
