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
  fireEvent,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { DatabaseObject, ConfigurationMethod } from '../../types';
import { EncryptedField, encryptedCredentialsMap } from './EncryptedField';

// Mock the useToasts hook
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    addInfoToast: jest.fn(),
    addWarningToast: jest.fn(),
  }),
}));

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
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
    onClearEncryptedExtraKey: jest.fn(),
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
    // Default to bigquery so existing credential-UI assertions aren't
    // affected by the gsheets-specific public/private dropdown. New tests
    // below override the engine to 'gsheets' to cover the dropdown gating.
    db: createMockDb('bigquery'),
    isPublic: false,
    setIsPublic: jest.fn(),
  };

  // Use actual encryptedCredentialsMap for data-driven tests
  const supportedEngines = Object.entries(encryptedCredentialsMap);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Engine-to-Field Mapping', () => {
    test.each(supportedEngines)(
      'resolves field name for %s engine → %s field',
      (engine, expectedField) => {
        const mockDb = createMockDb(engine);
        const props = { ...defaultProps, db: mockDb };

        render(<EncryptedField {...props} />);

        expectParametersChange(props.changeMethods, expectedField, '');
        expect(props.changeMethods.onParametersChange).toHaveBeenCalledTimes(1);
      },
    );

    test('handles unmapped engines gracefully', () => {
      const unmappedEngine = 'unknown-engine-xyz';
      const mockDb = createMockDb(unmappedEngine);
      const props = { ...defaultProps, db: mockDb };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // No engine-specific field name → mount effect skips the clear so it
      // doesn't write `parameters[undefined] = ''` to state.
      expect(props.changeMethods.onParametersChange).not.toHaveBeenCalled();
    });

    test.each([
      ['null engine', null],
      ['undefined engine', undefined],
      ['empty string engine', ''],
    ])('handles %s gracefully', (_description, engine) => {
      const mockDb = createMockDb(engine);
      const props = { ...defaultProps, db: mockDb };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      expect(props.changeMethods.onParametersChange).not.toHaveBeenCalled();
    });

    test('does not call onParametersChange when db is undefined (async load)', () => {
      const props = { ...defaultProps, db: undefined };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // Async edit-mode load: db hasn't arrived yet. The mount effect must
      // NOT race with the incoming credentials by clearing them.
      expect(props.changeMethods.onParametersChange).not.toHaveBeenCalled();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Parameter Value Processing', () => {
    // In edit mode the existing credential value must never be rendered into
    // the field, regardless of how it was returned from the backend.
    const editModeInputs = [
      {
        input: { key: 'value', nested: { data: 'test' } },
        description: 'objects',
      },
      { input: true, description: 'booleans' },
      { input: false, description: 'false booleans' },
      { input: 'test-string', description: 'strings' },
      { input: 123, description: 'numbers' },
    ];

    test.each(editModeInputs)(
      'does not render existing $description in edit mode',
      ({ input }) => {
        const mockDb = createMockDb('gsheets', {
          service_account_info: input,
        });
        const props = { ...defaultProps, db: mockDb, isEditMode: true };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe('');
      },
    );

    // The copy/paste (create) flow is controlled by the parent, which echoes
    // typed content back through `db.parameters`. Verify that values are still
    // serialized for display when not in edit mode.
    const createModeCases = [
      {
        input: { key: 'value', nested: { data: 'test' } },
        expected: '{"key":"value","nested":{"data":"test"}}',
        description: 'objects to JSON strings',
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
      {
        input: true,
        expected: 'true',
        description: 'true booleans to strings',
      },
      {
        input: false,
        expected: 'false',
        description: 'false booleans to strings',
      },
    ];

    test.each(createModeCases)(
      'processes $description correctly in create mode',
      ({ input, expected }) => {
        const mockDb = createMockDb('gsheets', {
          service_account_info: input,
        });
        const props = {
          ...defaultProps,
          db: mockDb,
          isEditMode: false,
          editNewDb: true,
        };

        const { container } = render(<EncryptedField {...props} />);
        const textarea = container.querySelector('textarea');

        expect(textarea?.value).toBe(expected);
      },
    );

    test('handles null/undefined parameters', () => {
      const mockDb = createMockDb('gsheets', {});
      const props = { ...defaultProps, db: mockDb, isEditMode: true };

      const { container } = render(<EncryptedField {...props} />);
      const textarea = container.querySelector('textarea');

      expect(textarea?.value).toBe('');
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Conditional Rendering Logic', () => {
    test('shows upload selector in create mode', () => {
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

    test('shows textarea in edit mode', () => {
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

    test('shows textarea when editNewDb is true', () => {
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

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Upload Option State Management', () => {
    test('defaults to upload option', () => {
      const props = { ...defaultProps, isEditMode: false };

      render(<EncryptedField {...props} />);

      expect(screen.getByText('Upload credentials')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    test('switches to copy-paste option', () => {
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

    test('uploading a file does not validate stale state, and validates once the parent commits the new value', async () => {
      const changeMethods = createMockChangeMethods();
      const getValidation = jest.fn();
      const fileContent = '{"type": "service_account"}';

      const { rerender } = render(
        <EncryptedField
          {...defaultProps}
          changeMethods={changeMethods}
          getValidation={getValidation}
          db={createMockDb('bigquery', { credentials_info: '' })}
        />,
      );

      const file = new File([fileContent], 'creds.json', {
        type: 'application/json',
      });
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() =>
        expect(changeMethods.onParametersChange).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({ value: fileContent }),
          }),
        ),
      );

      // The parent hasn't re-rendered with the committed value yet (in the
      // real app this is the reducer-dispatch/render gap) — validation must
      // not fire against the stale `db` in the meantime.
      expect(getValidation).not.toHaveBeenCalled();

      // Once the parent commits the update and re-renders with the new
      // `db.parameters.credentials_info`, validation should fire exactly
      // once, against the up-to-date value.
      rerender(
        <EncryptedField
          {...defaultProps}
          changeMethods={changeMethods}
          getValidation={getValidation}
          db={createMockDb('bigquery', { credentials_info: fileContent })}
        />,
      );

      await waitFor(() => expect(getValidation).toHaveBeenCalledTimes(1));
    });

    test('removing an upload before the parent commits clears the pending validation', async () => {
      const changeMethods = createMockChangeMethods();
      const getValidation = jest.fn();
      const fileContent = '{"type": "service_account"}';

      const { container, rerender } = render(
        <EncryptedField
          {...defaultProps}
          changeMethods={changeMethods}
          getValidation={getValidation}
          db={createMockDb('bigquery', { credentials_info: '' })}
        />,
      );

      const file = new File([fileContent], 'creds.json', {
        type: 'application/json',
      });
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() =>
        expect(changeMethods.onParametersChange).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({ value: fileContent }),
          }),
        ),
      );

      // Remove the upload before the parent has committed/re-rendered with
      // the uploaded content — this must clear the pending validation, not
      // just leave it dangling.
      const removeButton = container.querySelector(
        '[aria-label="delete"]',
      ) as HTMLElement;
      fireEvent.click(removeButton);

      // Even if some later, unrelated render happens to carry the same
      // content the removed upload had (e.g. stale props echoed back), the
      // cleared pending state must not fire a validation for it.
      rerender(
        <EncryptedField
          {...defaultProps}
          changeMethods={changeMethods}
          getValidation={getValidation}
          db={createMockDb('bigquery', { credentials_info: fileContent })}
        />,
      );

      expect(getValidation).not.toHaveBeenCalled();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Form Integration Contract', () => {
    test.each(supportedEngines)(
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

    test('initializes with empty value on mount', () => {
      const props = { ...defaultProps };

      render(<EncryptedField {...props} />);

      expectParametersChange(
        props.changeMethods,
        'credentials_info', // bigquery default
        '',
      );
    });

    test('renders correctly with default props', () => {
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

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  test('renderAsTextArea branch: renders a textarea element (not a plain input) in edit mode', () => {
    const props = { ...defaultProps, isEditMode: true };
    const { container } = render(<EncryptedField {...props} />);

    // renderAsTextArea causes LabeledErrorBoundInput to render <textarea>
    expect(container.querySelector('textarea')).toBeInTheDocument();
    expect(container.querySelector('input')).not.toBeInTheDocument();
  });

  test('renderAsTextArea branch: renders a textarea element in copy-paste mode', () => {
    const props = { ...defaultProps, isEditMode: false };
    render(<EncryptedField {...props} />);

    // Switch to copy-paste option to trigger renderAsTextArea branch
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    fireEvent.click(screen.getByText('Copy and Paste JSON credentials'));

    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  test('renderAsTextArea branch: does not render a textarea when upload option is selected', () => {
    const props = { ...defaultProps, isEditMode: false, editNewDb: false };
    render(<EncryptedField {...props} />);

    // Default upload option — no textarea should be present
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Upload credentials')).toBeInTheDocument();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Error Boundaries', () => {
    test('renders gracefully when database prop is missing', () => {
      const props = { ...defaultProps, db: undefined };

      expect(() => render(<EncryptedField {...props} />)).not.toThrow();

      // Mount effect skips the parameters clear when there's no
      // engine-specific field name to write to.
      expect(props.changeMethods.onParametersChange).not.toHaveBeenCalled();
    });

    test('renders gracefully with malformed database parameters', () => {
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

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Accessibility', () => {
    test('provides proper form labels and attributes', () => {
      const props = { ...defaultProps, isEditMode: true };

      render(<EncryptedField {...props} />);

      expect(screen.getByText('Service Account')).toBeInTheDocument();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('name', 'credentials_info');
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Paste content of service credentials JSON file here',
      );
    });

    test('provides proper labels for upload method selection', () => {
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

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Google Sheets public/private dropdown', () => {
    const gsheetsProps = {
      ...defaultProps,
      db: createMockDb('gsheets'),
    };

    test('renders the dropdown for gsheets', () => {
      render(<EncryptedField {...gsheetsProps} isPublic />);

      expect(
        screen.getByText('Type of Google Sheets allowed'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Publicly shared sheets only'),
      ).toBeInTheDocument();
    });

    test('does not render the dropdown for non-gsheets engines', () => {
      render(<EncryptedField {...defaultProps} />);

      expect(
        screen.queryByText('Type of Google Sheets allowed'),
      ).not.toBeInTheDocument();
    });

    test('hides credential inputs when isPublic is true', () => {
      render(<EncryptedField {...gsheetsProps} isPublic />);

      expect(
        screen.queryByText(
          'How do you want to enter service account credentials?',
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Upload credentials')).not.toBeInTheDocument();
      expect(screen.queryByText('Service Account')).not.toBeInTheDocument();
    });

    test('shows credential inputs when isPublic is false', () => {
      render(<EncryptedField {...gsheetsProps} isPublic={false} />);

      expect(
        screen.getByText(
          'How do you want to enter service account credentials?',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Upload credentials')).toBeInTheDocument();
    });

    test('hides credential textarea in edit mode when isPublic is true', () => {
      render(<EncryptedField {...gsheetsProps} isPublic isEditMode />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Service Account')).not.toBeInTheDocument();
    });

    test('toggling back to public clears stored credentials', () => {
      const setIsPublic = jest.fn();
      const changeMethods = createMockChangeMethods();
      render(
        <EncryptedField
          {...gsheetsProps}
          changeMethods={changeMethods}
          isPublic={false}
          setIsPublic={setIsPublic}
        />,
      );

      const dropdown = screen.getByText('Public and privately shared sheets');
      fireEvent.mouseDown(dropdown);
      fireEvent.click(screen.getByText('Publicly shared sheets only'));

      expect(setIsPublic).toHaveBeenCalledWith(true);

      // Clears in-flight `parameters.*` so the save-time merge does nothing.
      expect(changeMethods.onParametersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'service_account_info',
            value: '',
          }),
        }),
      );
      expect(changeMethods.onParametersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'oauth2_client_info',
            value: '',
          }),
        }),
      );

      // Also deletes `masked_encrypted_extra` keys directly via the dedicated
      // `ClearEncryptedExtraKey` action so previously stored credentials
      // don't survive a toggle in edit mode.
      expect(changeMethods.onClearEncryptedExtraKey).toHaveBeenCalledWith(
        'service_account_info',
      );
      expect(changeMethods.onClearEncryptedExtraKey).toHaveBeenCalledWith(
        'oauth2_client_info',
      );
      expect(changeMethods.onEncryptedExtraInputChange).not.toHaveBeenCalled();
    });
  });
});
