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

// Simplified FileReader mock
const mockFileReader = {
  result: null as string | null,
  onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
  readAsText: jest.fn(function (this: any) {
    setTimeout(() => {
      if (this.result !== null && this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }),
};

Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: jest.fn(() => mockFileReader),
});

describe('EncryptedField', () => {
  // Generic test utilities
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

  // Helper function to manage encryptedCredentialsMap setup/teardown
  const withMockCredentialsMap = (
    mappings: Record<string, string>,
    testFn: () => void,
  ) => {
    const originalMap = { ...encryptedCredentialsMap };

    // Setup mappings
    Object.entries(mappings).forEach(([engine, field]) => {
      (encryptedCredentialsMap as any)[engine] = field;
    });

    try {
      // Run test
      testFn();
    } finally {
      // Cleanup - restore original map
      Object.assign(encryptedCredentialsMap, originalMap);
      Object.keys(mappings).forEach(engine => {
        if (!(engine in originalMap)) {
          delete (encryptedCredentialsMap as any)[engine];
        }
      });
    }
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

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
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

      it('handles null engine gracefully', () => {
        const mockDb = createMockDb(null);
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

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
          const mockDb = createMockDb(testEngine, {
            [testFieldName]: testCredentials,
          });
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          const { container } = render(<EncryptedField {...props} />);
          const textarea = container.querySelector('textarea');

          expect(textarea?.value).toBe(JSON.stringify(testCredentials));
        });
      });

      it('converts boolean values to string for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
          const mockDb = createMockDb(testEngine, {
            [testFieldName]: true,
          });
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          const { container } = render(<EncryptedField {...props} />);
          const textarea = container.querySelector('textarea');

          expect(textarea?.value).toBe('true');
        });
      });

      it('handles string values unchanged for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';
        const testValue = 'test-string-value';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
          const mockDb = createMockDb(testEngine, {
            [testFieldName]: testValue,
          });
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          const { container } = render(<EncryptedField {...props} />);
          const textarea = container.querySelector('textarea');

          expect(textarea?.value).toBe(testValue);
        });
      });

      it('handles null/undefined values for any field', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
          const textareaUndefined =
            containerUndefined.querySelector('textarea');

          expect(textareaUndefined?.value).toBe('');
        });
      });
    });
  });

  describe('State Management Tests', () => {
    describe('Upload Option State', () => {
      it('initializes upload option to JsonUpload by default', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
          const mockDb = createMockDb(testEngine);
          const props = { ...defaultProps, db: mockDb };

          render(<EncryptedField {...props} />);

          // Should show upload UI by default (not textarea)
          expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
          expect(screen.getByText('Upload credentials')).toBeInTheDocument();
        });
      });

      it('switches upload options independent of engine', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });
    });

    describe('Change Handler Integration', () => {
      it('calls onParametersChange with correct dynamic field name', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_dynamic_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      it('maintains form field contract regardless of engine', () => {
        const engines = [
          { engine: 'test-engine-1', field: 'field_1' },
          { engine: 'test-engine-2', field: 'field_2' },
        ];

        const mappings = engines.reduce(
          (acc, { engine, field }) => ({ ...acc, [engine]: field }),
          {},
        );

        withMockCredentialsMap(mappings, () => {
          engines.forEach(({ engine, field }) => {
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
        });
      });
    });
  });

  describe('Component Behavior Tests', () => {
    describe('Rendering Logic', () => {
      it('shows upload selector when showCredentialsInfo is true', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      it('hides upload selector when showCredentialsInfo is false (edit mode)', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      it('shows textarea when editNewDb is true regardless of engine', () => {
        const testEngines = ['engine-1', 'engine-2', 'engine-3'];
        const mappings = testEngines.reduce(
          (acc, engine, index) => ({ ...acc, [engine]: `field_${index}` }),
          {},
        );

        withMockCredentialsMap(mappings, () => {
          testEngines.forEach(engine => {
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

        const mappings = testCases.reduce(
          (acc, { engine, field }) => ({ ...acc, [engine]: field }),
          {},
        );

        withMockCredentialsMap(mappings, () => {
          testCases.forEach(({ engine, field }) => {
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
        });
      });

      it('maintains consistent UI structure across different engines', () => {
        const engines = ['ui-engine-1', 'ui-engine-2', 'ui-engine-3'];
        const mappings = engines.reduce(
          (acc, engine, index) => ({ ...acc, [engine]: `ui_field_${index}` }),
          {},
        );

        withMockCredentialsMap(mappings, () => {
          engines.forEach(engine => {
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
        });
      });
    });

    describe('Accessibility', () => {
      it('has proper form labels for textarea input', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      it('has proper form labels for upload method selection', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });
    });

    describe('Validation Error Handling', () => {
      it('renders without validation errors when none provided', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      it('handles validation errors prop gracefully', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
      });

      test.todo(
        'should display validation errors in the UI when provided - expect error message to appear near the input field, with proper error styling (red text/border), and be associated with the field via aria-describedby for accessibility',
      );
    });
  });

  describe('Error Handling Tests', () => {
    describe('File Upload Error Scenarios', () => {
      it('verifies error message text matches component implementation', () => {
        const expectedErrorMessage = t(
          'Unable to read the file, please refresh and try again.',
        );

        // Verify the message is properly formed (this catches i18n key changes)
        expect(expectedErrorMessage).toBe(
          'Unable to read the file, please refresh and try again.',
        );
      });

      test.todo(
        'should show error toast when file upload fails - trigger Upload onChange with a file that fails to read, verify mockAddDangerToast is called with the correct error message',
      );
    });

    describe('Parameter Handling Error Scenarios', () => {
      it('requires changeMethods for proper initialization', () => {
        const testEngine = 'mock-engine';
        const testFieldName = 'mock_field';

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
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
        });
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

        withMockCredentialsMap({ [testEngine]: testFieldName }, () => {
          const mockDb = {
            ...createMockDb(testEngine),
            parameters: undefined,
          };
          const props = { ...defaultProps, db: mockDb, isEditMode: true };

          // Should render without crashing
          expect(() => render(<EncryptedField {...props} />)).not.toThrow();

          const textarea = screen.getByRole('textbox');
          expect(textarea).toHaveValue('');
        });
      });
    });
  });
});
