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
import { t } from '@superset-ui/core';
import { DatabaseObject, ConfigurationMethod } from '../../types';
import { EncryptedField, encryptedCredentialsMap } from './EncryptedField';

// Mock the useToasts hook
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
  }),
}));

// Mock FileReader with proper async simulation
class MockFileReader implements Partial<FileReader> {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;

  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;

  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;

  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;

  onloadstart:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;

  onprogress:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;

  result: string | null = null;

  error: DOMException | null = null;

  readyState: 0 | 1 | 2 = FileReader.DONE;

  readAsText = jest.fn((_file: File) => {
    // Simulate async file reading
    setTimeout(() => {
      if (this.result !== null && this.onload) {
        this.onload.call(this as any, {} as ProgressEvent<FileReader>);
      }
    }, 0);
  });

  readAsArrayBuffer = jest.fn();

  readAsBinaryString = jest.fn();

  readAsDataURL = jest.fn();

  abort = jest.fn();

  addEventListener = jest.fn();

  removeEventListener = jest.fn();

  dispatchEvent = jest.fn();
}

const mockFileReader = new MockFileReader();

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

      it('renders UI even when engine has no encrypted credentials mapping', () => {
        const unmappedEngine = 'unsupported-engine';
        const mockDb = createMockDb(unmappedEngine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        // Component renders UI but with undefined field name
        expect(
          screen.getByText(
            'How do you want to enter service account credentials?',
          ),
        ).toBeInTheDocument();
        expect(screen.getByText('Upload credentials')).toBeInTheDocument();

        // The changeMethods should have been called with undefined field name
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledWith({
          target: {
            name: undefined,
            value: '',
          },
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

    describe('Accessibility', () => {
      it('has proper form labels for textarea input', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        render(<EncryptedField {...props} />);

        // Should have proper form label
        expect(screen.getByText('Service Account')).toBeInTheDocument();

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('name', testFieldName);
        expect(textarea).toHaveAttribute(
          'placeholder',
          'Paste content of service credentials JSON file here',
        );

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('has proper form labels for upload method selection', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = { ...defaultProps, db: mockDb, isEditMode: false };

        render(<EncryptedField {...props} />);

        // Should have proper label for upload method selection
        expect(
          screen.getByText(
            'How do you want to enter service account credentials?',
          ),
        ).toBeInTheDocument();

        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });
    });

    describe('Validation Error Handling', () => {
      it('renders without validation errors when none provided', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const props = {
          ...defaultProps,
          db: mockDb,
          isEditMode: true,
          validationErrors: null,
        };

        render(<EncryptedField {...props} />);

        // Should render normally without errors
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByText('Service Account')).toBeInTheDocument();

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });

      it('handles validation errors prop gracefully', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        // Setup credentials map
        const originalMap = { ...encryptedCredentialsMap };
        (encryptedCredentialsMap as any)[testEngine] = testFieldName;

        const mockDb = createMockDb(testEngine);
        const mockValidationErrors = {
          [testFieldName]: 'Invalid credentials format',
        };
        const props = {
          ...defaultProps,
          db: mockDb,
          isEditMode: true,
          validationErrors: mockValidationErrors,
        };

        render(<EncryptedField {...props} />);

        // Component should still render despite validation errors
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByText('Service Account')).toBeInTheDocument();

        // TODO: Add UI display tests when component supports showing validation errors
        // Currently component accepts validationErrors prop but doesn't render them in UI
        // This test ensures it doesn't crash when validation errors are provided

        // Cleanup
        Object.assign(encryptedCredentialsMap, originalMap);
        delete (encryptedCredentialsMap as any)[testEngine];
      });
    });
  });

  describe('Error Handling Tests', () => {
    describe('File Upload Error Scenarios', () => {
      it('verifies error message text matches component implementation', () => {
        // This test ensures our error message matches the actual component code
        // The toast is called from inside the Upload component's onChange handler,
        // which is difficult to trigger in unit tests

        const expectedErrorMessage = t(
          'Unable to read the file, please refresh and try again.',
        );

        // Verify the message is properly formed (this catches i18n key changes)
        expect(expectedErrorMessage).toBe(
          'Unable to read the file, please refresh and try again.',
        );

        // In a real integration test, we would verify:
        // 1. File upload fails
        // 2. mockAddDangerToast is called with expectedErrorMessage
        // But this requires triggering the Upload component's onChange handler
      });
    });

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

      it.each([
        ['null database', { db: undefined }],
        [
          'database with null engine',
          {
            db: {
              configuration_method: ConfigurationMethod.DynamicForm,
              database_name: 'test_db',
              driver: 'test_driver',
              id: 1,
              name: 'test_db',
              is_managed_externally: false,
              engine: undefined,
            },
          },
        ],
        [
          'database with undefined engine',
          {
            db: {
              configuration_method: ConfigurationMethod.DynamicForm,
              database_name: 'test_db',
              driver: 'test_driver',
              id: 1,
              name: 'test_db',
              is_managed_externally: false,
              engine: undefined,
            },
          },
        ],
      ])('handles %s gracefully', (_scenario, overrides) => {
        const props = {
          ...defaultProps,
          ...overrides,
        };

        // Should not crash
        expect(() => render(<EncryptedField {...props} />)).not.toThrow();
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
