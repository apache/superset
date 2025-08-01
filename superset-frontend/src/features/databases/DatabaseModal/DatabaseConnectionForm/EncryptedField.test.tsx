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
import { DatabaseObject, ConfigurationMethod } from 'src/features/databases/types';
import { EncryptedField, encryptedCredentialsMap } from './EncryptedField';

// Mock the useToasts hook
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
  }),
}));

// Mock FileReader
const mockFileReader = {
  readAsText: jest.fn(),
  onload: null as any,
  onerror: null as any,
  result: null as any,
};

Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: jest.fn(() => mockFileReader),
});

describe('EncryptedField', () => {
  // Generic test utilities
  const createMockDb = (
    engine: string,
    parameters: Record<string, any> = {},
  ): DatabaseObject => ({
    configuration_method: ConfigurationMethod.DynamicForm,
    database_name: 'test-db',
    driver: 'test-driver',
    id: 1,
    name: 'Test Database',
    is_managed_externally: false,
    engine,
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
    db: createMockDb('test-engine'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileReader.readAsText.mockClear();
    mockFileReader.result = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  describe('Core Logic Tests', () => {
    describe('Field Name Resolution', () => {
      it('resolves field name from credentials map and engine', () => {
        const testEngine = 'mock-test-engine';
        const testFieldName = 'mock_credential_field';

        // Temporarily override the credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Verify the component initialized with correct field name
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith({
          target: {
            name: testFieldName,
            value: '',
          },
        });

        // Restore original map
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('handles undefined engine gracefully', () => {
        const mockDb = { ...createMockDb('test-engine'), engine: undefined };
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Should not crash and should call onParametersChange with undefined field name
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith({
          target: {
            name: undefined,
            value: '',
          },
        });
      });

      it('handles unmapped engine gracefully', () => {
        const unmappedEngine = 'unknown-engine-xyz';
        const mockDb = createMockDb(unmappedEngine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Should not crash and should call onParametersChange with undefined field name
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith({
          target: {
            name: undefined,
            value: '',
          },
        });
      });
    });

    describe('Parameter Value Processing', () => {
      it('converts object values to JSON string for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';
        const testCredentials = { key: 'value', nested: { data: 'test' } };

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine, {
          [testFieldName]: testCredentials,
        });
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe(JSON.stringify(testCredentials));

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('converts boolean values to string for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine, {
          [testFieldName]: true,
        });
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe('true');

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('handles string values unchanged for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';
        const testValue = 'test-string-value';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine, {
          [testFieldName]: testValue,
        });
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe(testValue);

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('handles null/undefined values for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        // Test with undefined
        const mockDbUndefined = createMockDb(testEngine, {});
        const propsUndefined = {
          ...defaultProps,
          db: mockDbUndefined,
          isEditMode: true,
        };

        const { container: containerUndefined } = render(
          <EncryptedField {...propsUndefined} />,
        );
        const textareaUndefined = containerUndefined.querySelector('textarea');

        expect(textareaUndefined?.value).toBe('');

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });
    });
  });

  describe('State Management Tests', () => {
    describe('Upload Option State', () => {
      it('initializes upload option to JsonUpload by default', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Should show upload UI by default (not textarea)
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText('Upload credentials')).toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('switches upload options independent of engine', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Find and click the select dropdown
        const select = screen.getByRole('combobox');
        fireEvent.mouseDown(select);

        // Click the "Copy and Paste JSON credentials" option
        const copyPasteOption = screen.getByText(
          'Copy and Paste JSON credentials',
        );
        fireEvent.click(copyPasteOption);

        // Should now show textarea instead of upload UI
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(
          screen.queryByText('Upload credentials'),
        ).not.toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });
    });

    describe('Change Handler Integration', () => {
      it('calls onParametersChange with correct dynamic field name', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_dynamic_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        render(<EncryptedField {...props} />);

        const textarea = screen.getByRole('textbox');
        const testValue = 'test credential content';

        fireEvent.change(textarea, { target: { value: testValue } });

        // Should call onParametersChange with the dynamic field name
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({
              name: testFieldName,
              value: testValue,
            }),
          }),
        );

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('maintains form field contract regardless of engine', () => {
        const engines = [
          { engine: 'test-engine-1', field: 'field_1' },
          { engine: 'test-engine-2', field: 'field_2' },
        ];

        const originalMap = { ...encryptedCredentialsMap };

        engines.forEach(({ engine, field }) => {
          // Setup credentials map
          (encryptedCredentialsMap as any)[engine] = field;

          const mockDb = createMockDb(engine);
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          const { unmount } = render(<EncryptedField {...props} />);

          const textarea = screen.getByRole('textbox');
          fireEvent.change(textarea, { target: { value: 'test' } });

          // Should maintain the same event structure regardless of engine
          expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith(
            expect.objectContaining({
              target: expect.objectContaining({
                name: field,
                value: 'test',
              }),
            }),
          );

          unmount();
          jest.clearAllMocks();
        });

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        engines.forEach(({ engine }) => {
          delete (encryptedCredentialsMap as any)[engine];
        });
      });
    });
  });

  describe('Component Behavior Tests', () => {
    describe('Rendering Logic', () => {
      it('shows upload selector when showCredentialsInfo is true', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: false };

        render(<EncryptedField {...props} />);

        // Should show the upload method selection
        expect(
          screen.getByText(
            'How do you want to enter service account credentials?',
          ),
        ).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('hides upload selector when showCredentialsInfo is false (edit mode)', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        render(<EncryptedField {...props} />);

        // Should NOT show the upload method selection
        expect(
          screen.queryByText(
            'How do you want to enter service account credentials?',
          ),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

        // Should show textarea directly
        expect(screen.getByRole('textbox')).toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('shows textarea when editNewDb is true regardless of engine', () => {
        const testEngines = ['engine-1', 'engine-2', 'engine-3'];
        const originalMap = { ...encryptedCredentialsMap };

        testEngines.forEach((engine, index) => {
          const fieldName = `field_${index}`;
          (encryptedCredentialsMap as any)[engine] = fieldName;

          const mockDb = createMockDb(engine);
          const props = {
            ...defaultProps,
            db: mockDb,
            editNewDb: true,
            isEditMode: false,
          };

          const { unmount } = render(<EncryptedField {...props} />);

          // Should show textarea even though not in edit mode
          expect(screen.getByRole('textbox')).toBeInTheDocument();
          expect(screen.getByText('Service Account')).toBeInTheDocument();

          unmount();
        });

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        testEngines.forEach(engine => {
          delete (encryptedCredentialsMap as any)[engine];
        });
      });
    });

    describe('Form Integration Behavior', () => {
      it('integrates with form validation using any field name', () => {
        const testCases = [
          { engine: 'validation-engine-1', field: 'validation_field_1' },
          { engine: 'validation-engine-2', field: 'validation_field_2' },
        ];

        const originalMap = { ...encryptedCredentialsMap };

        testCases.forEach(({ engine, field }) => {
          // Setup credentials map
          (encryptedCredentialsMap as any)[engine] = field;

          const mockDb = createMockDb(engine);
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          const { unmount } = render(<EncryptedField {...props} />);

          const textarea = screen.getByRole('textbox');

          // Should have the correct name attribute
          expect(textarea).toHaveAttribute('name', field);

          // Should integrate with form field structure
          expect(screen.getByText('Service Account')).toBeInTheDocument();

          unmount();
        });

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        testCases.forEach(({ engine }) => {
          delete (encryptedCredentialsMap as any)[engine];
        });
      });

      it('maintains consistent UI structure across different engines', () => {
        const engines = ['ui-engine-1', 'ui-engine-2', 'ui-engine-3'];
        const originalMap = { ...encryptedCredentialsMap };

        engines.forEach((engine, index) => {
          const fieldName = `ui_field_${index}`;
          (encryptedCredentialsMap as any)[engine] = fieldName;

          const mockDb = createMockDb(engine);
          const props = { ...defaultProps, db: mockDb };

          const { unmount } = render(<EncryptedField {...props} />);

          // All engines should have the same basic UI structure
          expect(
            screen.getByText(
              'How do you want to enter service account credentials?',
            ),
          ).toBeInTheDocument();
          expect(screen.getByRole('combobox')).toBeInTheDocument();
          expect(screen.getByText('Upload credentials')).toBeInTheDocument();

          unmount();
        });

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        engines.forEach(engine => {
          delete (encryptedCredentialsMap as any)[engine];
        });
      });
    });
  });

  describe('Error Handling Tests', () => {
    describe('Parameter Handling Error Scenarios', () => {
      it('requires changeMethods for proper initialization', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        render(<EncryptedField {...props} />);

        // Should call onParametersChange during initialization
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith({
          target: {
            name: testFieldName,
            value: '',
          },
        });

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('handles malformed database object gracefully', () => {
        const props = {
          ...defaultProps,
          db: null as any,
        };

        // Should not crash with null db
        expect(() => render(<EncryptedField {...props} />)).not.toThrow();

        const malformedDb = { engine: null } as any;
        const propsWithMalformed = { ...defaultProps, db: malformedDb };

        // Should not crash with malformed db
        expect(() =>
          render(<EncryptedField {...propsWithMalformed} />),
        ).not.toThrow();
      });

      it('handles undefined parameters gracefully', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = {
          ...createMockDb(testEngine),
          parameters: undefined,
        };
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        // Should render without crashing
        expect(() => render(<EncryptedField {...props} />)).not.toThrow();

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveValue('');

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });
    });
  });
});
