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

import { render, fireEvent, screen } from 'spec/helpers/testing-library';
import { DatabaseObject, ConfigurationMethod } from '../../types';
import { EncryptedField, encryptedCredentialsMap } from './EncryptedField';

// Mock the useToasts hook
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: jest.fn(),
  }),
}));

describe('EncryptedField', () => {
  // Test utilities
  const createMockDb = (
    engine: string | null | undefined,
    parameters: Record<string, any> = {},
  ): DatabaseObject => ({
    configuration_method: ConfigurationMethod.DynamicForm,
    database_name: 'test-db',
    driver: 'test-driver',
    id: 1,
    name: 'Test Database',
    is_managed_externally: false,
    engine: engine as string | undefined,
    parameters,
  });

  const createMockChangeMethods = () => ({
    onEncryptedExtraInputChange: jest.fn(),
    onParametersChange: jest.fn(),
    onChange: jest.fn(),
    onQueryChange: jest.fn(),
    onParametersUploadFileChange: jest.fn(),
    onAddTableCatalog: jest.fn(),
    onRemoveTableCatalog: jest.fn(),
    onExtraInputChange: jest.fn(),
    onSSHTunnelParametersChange: jest.fn(),
  });

  // Helper function to assert onParametersChange calls
  const expectParametersChange = (
    changeMethods: ReturnType<typeof createMockChangeMethods>,
    fieldName: string | null | undefined,
    value: string,
    callIndex = 0,
  ) => {
    expect(changeMethods.onParametersChange).toHaveBeenNthCalledWith(
      callIndex + 1,
      expect.objectContaining({
        target: expect.objectContaining({
          name: fieldName,
          value,
        }),
      }),
    );
  };

  const defaultProps = {
    required: false,
    onParametersChange: jest.fn(),
    onParametersUploadFileChange: jest.fn(),
    changeMethods: createMockChangeMethods(),
    validationErrors: null,
    getValidation: jest.fn(),
    clearValidationErrors: jest.fn(),
    field: 'test',
    isValidating: false,
    isEditMode: false,
    editNewDb: false,
    db: createMockDb('gsheets'),
  };

  // Use actual encryptedCredentialsMap for data-driven tests
  const supportedEngines = Object.entries(encryptedCredentialsMap);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Engine-to-Field Mapping', () => {
    it.each(supportedEngines)(
      'resolves field name for %s engine → %s field',
      (engine, expectedField) => {
        const mockDb = createMockDb(engine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        expectParametersChange(props.changeMethods, expectedField, '');
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledTimes(1);
      },
    );

    it('handles unmapped engines gracefully', () => {
      const unmappedEngine = 'unknown-engine-xyz';
      const mockDb = createMockDb(unmappedEngine);
      const props = { ...defaultProps, db: mockDb };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      expectParametersChange(props.changeMethods, undefined, '');
      expect(props.changeMethods.onParametersChange).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['null engine', null, null],
      ['undefined engine', undefined, undefined],
      ['empty string engine', '', ''],
    ])('handles %s gracefully', (_description, engine, expectedName) => {
      const mockDb = createMockDb(engine);
      const props = { ...defaultProps, db: mockDb };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      expectParametersChange(props.changeMethods, expectedName, '');
      expect(props.changeMethods.onParametersChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Parameter Value Processing', () => {
    const testCases = [
      {
        input: { key: 'value', nested: { data: 'test' } },
        expected: '{"key":"value","nested":{"data":"test"}}',
        description: 'objects to JSON strings',
      },
      {
        input: true,
        expected: 'true',
        description: 'booleans to strings',
      },
      {
        input: false,
        expected: 'false',
        description: 'false booleans to strings',
      },
      {
        input: 'test-string',
        expected: 'test-string',
        description: 'string values unchanged',
      },
      {
        input: 123,
        expected: '123',
        description: 'numbers to strings',
      },
    ];

    it.each(testCases)(
      'processes $description correctly',
      ({ input, expected }) => {
        const mockDb = createMockDb('gsheets', {
          service_account_info: input,
        });
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe(expected);
      },
    );

    it('handles null/undefined parameters', () => {
      const mockDb = createMockDb('gsheets', {});
      const props = { ...defaultProps, db: mockDb, isEditMode: true };

      const { container } = render(<EncryptedField {...props} />);
      const textarea = container.querySelector('textarea');

      expect(textarea?.value).toBe('');
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('shows upload selector in create mode', () => {
      const props = { ...defaultProps, isEditMode: false, editNewDb: false };

      render(<EncryptedField {...props} />);

      expect(
        screen.getByText(
          'How do you want to enter service account credentials?',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('shows textarea in edit mode', () => {
      const props = { ...defaultProps, isEditMode: true, editNewDb: false };

      render(<EncryptedField {...props} />);

      expect(
        screen.queryByText(
          'How do you want to enter service account credentials?',
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows textarea when editNewDb is true', () => {
      const props = { ...defaultProps, isEditMode: false, editNewDb: true };

      render(<EncryptedField {...props} />);

      // When editNewDb is true and isEditMode is false, both select and textarea are shown
      expect(
        screen.getByText(
          'How do you want to enter service account credentials?',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Upload Option State Management', () => {
    it('defaults to upload option', () => {
      const props = { ...defaultProps, isEditMode: false };

      render(<EncryptedField {...props} />);

      expect(screen.getByText('Upload credentials')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('switches to copy-paste option', () => {
      const props = { ...defaultProps, isEditMode: false };

      render(<EncryptedField {...props} />);

      const select = screen.getByRole('combobox');
      fireEvent.mouseDown(select);

      const copyPasteOption = screen.getByText(
        'Copy and Paste JSON credentials',
      );
      fireEvent.click(copyPasteOption);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByText('Upload credentials')).not.toBeInTheDocument();
    });
  });

  describe('Form Integration Contract', () => {
    it.each(supportedEngines)(
      'calls onParametersChange with correct field name for %s engine',
      (engine, fieldName) => {
        const mockDb = createMockDb(engine);
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        render(<EncryptedField {...props} />);

        const textarea = screen.getByRole('textbox');
        const testValue = 'test credential content';

        fireEvent.change(textarea, { target: { value: testValue } });

        expectParametersChange(props.changeMethods, fieldName, testValue, 1);
      },
    );

    it('initializes with empty value on mount', () => {
      const props = { ...defaultProps };

      render(<EncryptedField {...props} />);

      expectParametersChange(
        props.changeMethods,
        'service_account_info', // gsheets default
        '',
      );
    });

    it('renders correctly with default props', () => {
      const props = { ...defaultProps };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // Should render upload UI by default
      expect(
        screen.getByText(
          'How do you want to enter service account credentials?',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Upload credentials')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('renders gracefully when database prop is missing', () => {
      const props = { ...defaultProps, db: undefined };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // Should still render the upload UI with undefined field name
      expectParametersChange(props.changeMethods, undefined, '');
    });

    it('renders gracefully with malformed database parameters', () => {
      const mockDb = createMockDb('gsheets', {
        service_account_info: Symbol('test-symbol'),
      });
      const props = { ...defaultProps, db: mockDb, isEditMode: true };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // Should still render textarea in edit mode
      const { container } = render(<EncryptedField {...props} />);
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper form labels and attributes', () => {
      const props = { ...defaultProps, isEditMode: true };

      render(<EncryptedField {...props} />);

      expect(screen.getByText('Service Account')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('name', 'service_account_info');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Paste content of service credentials JSON file here',
      );
    });

    it('provides proper labels for upload method selection', () => {
      const props = { ...defaultProps, isEditMode: false };

      render(<EncryptedField {...props} />);

      expect(
        screen.getByText(
          'How do you want to enter service account credentials?',
        ),
      ).toBeInTheDocument();

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });
});
