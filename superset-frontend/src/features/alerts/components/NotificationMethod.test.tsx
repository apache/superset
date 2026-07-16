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
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { ReactNode } from 'react';

import {
  FeatureFlag,
  JsonResponse,
  SupersetClient,
  TextResponse,
} from '@superset-ui/core';
import rison from 'rison';
import { NotificationMethod, mapSlackValues } from './NotificationMethod';
import { NotificationMethodOption, NotificationSetting } from '../types';

type MockAsyncSelectOption = {
  label: string;
  value: string;
};

type MockAsyncSelectProps = {
  ariaLabel?: string;
  'data-test'?: string;
  name?: string;
  onChange?: (value: MockAsyncSelectOption[]) => void;
  options?: (
    filterValue: string,
    page: number,
    pageSize: number,
  ) => Promise<{ data: MockAsyncSelectOption[]; totalCount: number }>;
  placeholder?: string;
  value?: MockAsyncSelectOption[];
};

type MockInputProps = {
  'data-test'?: string;
  name?: string;
  onChange?: (event: { target: { value: string } }) => void;
  placeholder?: string;
  type?: string;
  value?: string;
};

type MockSelectProps = {
  'data-test'?: string;
  ariaLabel?: string;
  loading?: boolean;
  name?: string;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  value?: { label?: string; value?: string } | MockAsyncSelectOption[];
};

jest.mock('@superset-ui/core/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Input = Object.assign(
    ({
      'data-test': dataTest,
      onChange,
      placeholder,
      type = 'text',
      value = '',
      ...rest
    }: MockInputProps) => (
      <input
        data-test={dataTest}
        onChange={({ target: { value: inputValue } }) =>
          onChange?.({ target: { value: inputValue } })
        }
        placeholder={placeholder}
        type={type}
        value={value}
        {...rest}
      />
    ),
    {
      TextArea: ({
        'data-test': dataTest,
        onChange,
        value = '',
        ...rest
      }: MockInputProps) => (
        <textarea
          data-test={dataTest}
          onChange={({ target: { value: inputValue } }) =>
            onChange?.({ target: { value: inputValue } })
          }
          value={value}
          {...rest}
        />
      ),
    },
  );

  return {
    Input,
    Select: ({
      'data-test': dataTest,
      ariaLabel,
      name,
      placeholder,
      value,
    }: MockSelectProps) => {
      const label = Array.isArray(value) ? undefined : value?.label;

      return (
        <div>
          <input
            aria-label={ariaLabel ?? name}
            data-test={dataTest}
            placeholder={placeholder}
            readOnly
            value={label ?? ''}
          />
          {label && <span title={label}>{label}</span>}
        </div>
      );
    },
    AsyncSelect: ({
      ariaLabel,
      'data-test': dataTest,
      name,
      onChange,
      options,
      placeholder,
      value = [],
    }: MockAsyncSelectProps) => {
      const [loadedOptions, setLoadedOptions] = React.useState<
        MockAsyncSelectOption[]
      >([]);
      const [searchValue, setSearchValue] = React.useState('');
      const inputRef = React.useRef<HTMLInputElement>(null);

      return (
        <>
          <input
            aria-label={ariaLabel ?? name}
            data-test={dataTest}
            placeholder={placeholder}
            ref={inputRef}
            value={searchValue || value.map(option => option.value).join(',')}
            onChange={({ target: { value: inputValue } }) => {
              setSearchValue(inputValue);
              onChange?.(
                inputValue
                  .split(/[,;]/)
                  .map(option => option.trim())
                  .filter(Boolean)
                  .map(option => ({ label: option, value: option })),
              );
            }}
          />
          {options && dataTest && (
            <button
              data-test={`${dataTest}-load-options`}
              type="button"
              onClick={async () => {
                const result = await options(
                  inputRef.current?.value ?? '',
                  0,
                  25,
                );
                setLoadedOptions(result.data);
              }}
            >
              Load options
            </button>
          )}
          {loadedOptions.map(option => (
            <span key={option.value}>{option.label}</span>
          ))}
        </>
      );
    },
  };
});

jest.mock('../AlertReportModal', () => ({
  StyledInputContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockOnUpdate = jest.fn();
const mockOnRemove = jest.fn();
const mockOnInputChange = jest.fn();
const mockSetErrorSubject = jest.fn();

const mockSetting: NotificationSetting = {
  method: NotificationMethodOption.Email,
  recipients: 'test@example.com',
  options: [
    NotificationMethodOption.Email,
    NotificationMethodOption.Slack,
    NotificationMethodOption.SlackV2,
  ],
};

const mockEmailSubject = 'Test Subject';
const mockDefaultSubject = 'Default Subject';

const mockSettingSlackV2: NotificationSetting = {
  method: NotificationMethodOption.SlackV2,
  recipients: 'slack-channel',
  options: [
    NotificationMethodOption.Email,
    NotificationMethodOption.Slack,
    NotificationMethodOption.SlackV2,
  ],
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('NotificationMethod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  test('should render the component', () => {
    render(
      <NotificationMethod
        setting={mockSetting}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    expect(screen.getByText('Notification Method')).toBeInTheDocument();
    expect(
      screen.getByText('Email subject name (optional)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Email recipients')).toBeInTheDocument();
  });

  test('should call onRemove when the delete button is clicked', () => {
    render(
      <NotificationMethod
        setting={mockSetting}
        index={1}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    const deleteButton = document.querySelector('.delete-button');
    if (deleteButton) userEvent.click(deleteButton);

    expect(mockOnRemove).toHaveBeenCalledWith(1);
  });

  test('should update recipient value when input changes', () => {
    render(
      <NotificationMethod
        setting={mockSetting}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    const recipientsInput = screen.getByTestId('recipients');
    fireEvent.change(recipientsInput, {
      target: { value: 'test1@example.com' },
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(0, {
      ...mockSetting,
      recipients: 'test1@example.com',
    });
  });

  test('should call onRecipientsChange when the recipients value is changed', () => {
    render(
      <NotificationMethod
        setting={mockSetting}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    const recipientsInput = screen.getByTestId('recipients');
    fireEvent.change(recipientsInput, {
      target: { value: 'test1@example.com' },
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(0, {
      ...mockSetting,
      recipients: 'test1@example.com',
    });
  });

  test('should load email recipient options from report users', async () => {
    jest.spyOn(SupersetClient, 'get').mockResolvedValueOnce({
      json: {
        count: 1,
        result: [
          {
            text: 'Test User',
            value: 1,
            extra: {
              email: 'test@example.com',
            },
          },
        ],
      },
    } as unknown as JsonResponse);

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          options: [NotificationMethodOption.Email],
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    const filterValue = 'test +&#';
    fireEvent.change(screen.getByTestId('recipients'), {
      target: { value: filterValue },
    });
    fireEvent.click(screen.getByTestId('recipients-load-options'));

    expect(
      await screen.findByText('Test User <test@example.com>'),
    ).toBeInTheDocument();
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining(
          '/api/v1/report/related/created_by?q=',
        ),
      }),
    );
    expect(SupersetClient.get).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining(
          `q=${rison.encode_uri({
            filter: filterValue,
            page: 0,
            page_size: 25,
            order_column: 'username',
            order_direction: 'asc',
          })}`,
        ),
      }),
    );
  });

  test('should correctly map recipients when method is SlackV2', () => {
    const method = 'SlackV2';
    const recipientValue = 'user1,user2';
    const slackOptions: { label: string; value: string }[] = [
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ];

    const result = mapSlackValues({ method, recipientValue, slackOptions });

    expect(result).toEqual([
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ]);
  });

  test('should return an empty array when recipientValue is an empty string', () => {
    const method = 'SlackV2';
    const recipientValue = '';
    const slackOptions: { label: string; value: string }[] = [
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ];

    const result = mapSlackValues({ method, recipientValue, slackOptions });

    expect(result).toEqual([]);
  });

  test('should correctly map recipients when method is Slack with updated recipient values', () => {
    const method = 'Slack';
    const recipientValue = 'User One,User Two';
    const slackOptions: { label: string; value: string }[] = [
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ];

    const result = mapSlackValues({ method, recipientValue, slackOptions });

    expect(result).toEqual([
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ]);
  });
  test('should render CC and BCC fields when method is Email and visibility flags are true', () => {
    const defaultProps = {
      setting: {
        method: NotificationMethodOption.Email,
        recipients: 'recipient1@example.com, recipient2@example.com',
        cc: 'cc1@example.com',
        bcc: 'bcc1@example.com',
        options: [
          NotificationMethodOption.Email,
          NotificationMethodOption.Slack,
        ],
      },
      index: 0,
      onUpdate: jest.fn(),
      onRemove: jest.fn(),
      onInputChange: jest.fn(),
      email_subject: 'Test Subject',
      defaultSubject: 'Default Subject',
      setErrorSubject: jest.fn(),
    };

    const { getByTestId } = render(<NotificationMethod {...defaultProps} />);

    // Check if CC and BCC fields are rendered
    expect(getByTestId('cc')).toBeInTheDocument();
    expect(getByTestId('bcc')).toBeInTheDocument();
  });
  test('should render CC and BCC fields with correct values when method is Email', () => {
    const defaultProps = {
      setting: {
        method: NotificationMethodOption.Email,
        recipients: 'recipient1@example.com, recipient2@example.com',
        cc: 'cc1@example.com',
        bcc: 'bcc1@example.com',
        options: [
          NotificationMethodOption.Email,
          NotificationMethodOption.Slack,
        ],
      },
      index: 0,
      onUpdate: jest.fn(),
      onRemove: jest.fn(),
      onInputChange: jest.fn(),
      email_subject: 'Test Subject',
      defaultSubject: 'Default Subject',
      setErrorSubject: jest.fn(),
    };

    const { getByTestId } = render(<NotificationMethod {...defaultProps} />);

    // Check if CC and BCC fields are rendered with correct values
    expect(getByTestId('cc')).toHaveValue('cc1@example.com');
    expect(getByTestId('bcc')).toHaveValue('bcc1@example.com');
  });
  test('should not render CC and BCC fields when method is not Email', () => {
    const defaultProps = {
      setting: {
        method: NotificationMethodOption.Slack,
        recipients: 'recipient1@example.com, recipient2@example.com',
        cc: 'cc1@example.com',
        bcc: 'bcc1@example.com',
        options: [
          NotificationMethodOption.Email,
          NotificationMethodOption.Slack,
        ],
      },
      index: 0,
      onUpdate: jest.fn(),
      onRemove: jest.fn(),
      onInputChange: jest.fn(),
      email_subject: 'Test Subject',
      defaultSubject: 'Default Subject',
      setErrorSubject: jest.fn(),
    };

    const { queryByTestId } = render(<NotificationMethod {...defaultProps} />);

    // Check if CC and BCC fields are not rendered
    expect(queryByTestId('cc')).not.toBeInTheDocument();
    expect(queryByTestId('bcc')).not.toBeInTheDocument();
  });
  // Handle empty recipients list gracefully
  test('should handle empty recipients list gracefully', () => {
    const defaultProps = {
      setting: {
        method: NotificationMethodOption.Email,
        recipients: '',
        cc: '',
        bcc: '',
        options: [
          NotificationMethodOption.Email,
          NotificationMethodOption.Slack,
        ],
      },
      index: 0,
      onUpdate: jest.fn(),
      onRemove: jest.fn(),
      onInputChange: jest.fn(),
      email_subject: 'Test Subject',
      defaultSubject: 'Default Subject',
      setErrorSubject: jest.fn(),
    };

    const { queryByTestId } = render(<NotificationMethod {...defaultProps} />);

    // Check if CC and BCC fields are not rendered
    expect(queryByTestId('cc')).not.toBeInTheDocument();
    expect(queryByTestId('bcc')).not.toBeInTheDocument();
  });
  test('shows the right combo when ff is false', async () => {
    /* should show the div with "Recipients are separated by"
    when FeatureFlag.AlertReportSlackV2 is false and fetchSlackChannels errors
    */
    // Mock the feature flag to be false
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: false };

    // Mock the SupersetClient.get to simulate an error
    jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
      throw new Error('Error fetching Slack channels');
    });

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          method: NotificationMethodOption.Slack,
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    // Wait for the component to handle the error and render the expected div
    await waitFor(() => {
      expect(
        screen.getByText('Recipients are separated by "," or ";"'),
      ).toBeInTheDocument();
    });
  });
  test('shows the textbox when the fetch fails', async () => {
    /* should show the div with "Recipients are separated by"
    when FeatureFlag.AlertReportSlackV2 is true and fetchSlackChannels errors
    */

    // Mock the feature flag to be false
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: false };

    // Mock the SupersetClient.get to simulate an error
    jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
      throw new Error('Error fetching Slack channels');
    });

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          method: NotificationMethodOption.Slack,
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    // Wait for the component to handle the error and render the expected div
    await waitFor(() => {
      expect(
        screen.getByText('Recipients are separated by "," or ";"'),
      ).toBeInTheDocument();
    });
  });
  test('shows the dropdown when ff is true and slackChannels succeed', async () => {
    /* should show the Select channels dropdown
    when FeatureFlag.AlertReportSlackV2 is true and fetchSlackChannels succeeds
    */
    // Mock the feature flag to be false
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

    // Mock the SupersetClient.get to simulate an error
    jest
      .spyOn(SupersetClient, 'get')
      .mockImplementation(
        () =>
          Promise.resolve({ json: { result: [] } }) as unknown as Promise<
            Response | JsonResponse | TextResponse
          >,
      );

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          method: NotificationMethodOption.SlackV2,
          recipients: 'slack-channel',
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    // Wait for the component to handle the error and render the expected div
    await waitFor(() => {
      expect(screen.getByTitle('Slack')).toBeInTheDocument();
    });
  });
  test('shows the textarea when ff is true and slackChannels fail', async () => {
    /* should show the Select channels dropdown
    when FeatureFlag.AlertReportSlackV2 is true and fetchSlackChannels succeeds
    */
    // Mock the feature flag to be false
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

    // Mock the SupersetClient.get to simulate an error
    jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
      throw new Error('Error fetching Slack channels');
    });

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          method: NotificationMethodOption.Slack,
          recipients: 'slack-channel',
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    // Wait for the component to handle the error and render the expected div
    expect(
      screen.getByText('Recipients are separated by "," or ";"'),
    ).toBeInTheDocument();
  });
  test('shows the textarea when ff is true and slackChannels fail and slack is selected', async () => {
    /* should show the Select channels dropdown
    when FeatureFlag.AlertReportSlackV2 is true and fetchSlackChannels succeeds
    */
    // Mock the feature flag to be false
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

    // Mock the SupersetClient.get to simulate an error
    jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
      throw new Error('Error fetching Slack channels');
    });

    render(
      <NotificationMethod
        setting={{
          ...mockSetting,
          method: NotificationMethodOption.Slack,
          recipients: 'slack-channel',
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    // Wait for the component to handle the error and render the expected div
    expect(
      screen.getByText('Recipients are separated by "," or ";"'),
    ).toBeInTheDocument();
  });

  test('shows the textarea when ff is true, slackChannels fail and slack is selected', async () => {
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
    jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
      throw new Error('Error fetching Slack channels');
    });

    render(
      <NotificationMethod
        setting={{
          ...mockSettingSlackV2,
          method: NotificationMethodOption.Slack,
        }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    expect(
      screen.getByText('Recipients are separated by "," or ";"'),
    ).toBeInTheDocument();
  });

  test('fetches Slack channels lazily with pagination for SlackV2', async () => {
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
    const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: {
        count: 1,
        result: [
          { id: 'C123', name: 'general', is_private: false, is_member: true },
        ],
      },
    } as unknown as JsonResponse);

    render(
      <NotificationMethod
        setting={{ ...mockSettingSlackV2, recipients: '' }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    fireEvent.click(await screen.findByTestId('recipients-load-options'));

    expect(await screen.findByText('general')).toBeInTheDocument();

    const slackEndpoint = getSpy.mock.calls
      .map(([arg]) => (arg as { endpoint: string }).endpoint)
      .find(endpoint => endpoint.includes('/report/slack_channels/'));
    expect(slackEndpoint).toBeDefined();
    expect(rison.decode(slackEndpoint!.split('?q=')[1])).toMatchObject({
      search_string: '',
      types: ['public_channel', 'private_channel'],
      page: 0,
      page_size: 25,
    });
  });

  test('allows entering a Slack channel id directly for SlackV2', async () => {
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
    jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: { count: 0, result: [] },
    } as unknown as JsonResponse);

    render(
      <NotificationMethod
        setting={{ ...mockSettingSlackV2, recipients: '' }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    fireEvent.change(await screen.findByTestId('recipients'), {
      target: { value: 'C0123456789' },
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ recipients: 'C0123456789' }),
    );
  });

  test('resolves saved SlackV2 channel ids on mount via exact match', async () => {
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
    const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: {
        count: 1,
        result: [
          { id: 'C123', name: 'general', is_private: false, is_member: true },
        ],
      },
    } as unknown as JsonResponse);

    render(
      <NotificationMethod
        setting={{ ...mockSettingSlackV2, recipients: 'C123' }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    await waitFor(() => {
      const slackEndpoint = getSpy.mock.calls
        .map(([arg]) => (arg as { endpoint: string }).endpoint)
        .find(endpoint => endpoint.includes('/report/slack_channels/'));
      expect(slackEndpoint).toBeDefined();
      expect(rison.decode(slackEndpoint!.split('?q=')[1])).toMatchObject({
        exact_match: true,
        search_string: 'C123',
      });
    });
  });

  test('force refresh triggers a cache-busting fetch for SlackV2', async () => {
    window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
    const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: { count: 0, result: [] },
    } as unknown as JsonResponse);

    render(
      <NotificationMethod
        setting={{ ...mockSettingSlackV2, recipients: '' }}
        index={0}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        onInputChange={mockOnInputChange}
        email_subject={mockEmailSubject}
        defaultSubject={mockDefaultSubject}
        setErrorSubject={mockSetErrorSubject}
      />,
    );

    userEvent.click(await screen.findByLabelText('sync'));
    fireEvent.click(await screen.findByTestId('recipients-load-options'));

    await waitFor(() => {
      const forced = getSpy.mock.calls
        .map(([arg]) => (arg as { endpoint: string }).endpoint)
        .filter(endpoint => endpoint.includes('/report/slack_channels/'))
        .some(
          endpoint =>
            (rison.decode(endpoint.split('?q=')[1]) as { force?: boolean })
              .force === true,
        );
      expect(forced).toBe(true);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('RefreshLabel functionality', () => {
    test('should call updateSlackOptions with force true when RefreshLabel is clicked', async () => {
      // Set feature flag so that SlackV2 branch renders RefreshLabel
      window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
      // Spy on SupersetClient.get which is called by updateSlackOptions
      const supersetClientSpy = jest
        .spyOn(SupersetClient, 'get')
        .mockImplementation(
          () =>
            Promise.resolve({ json: { result: [] } }) as unknown as Promise<
              Response | JsonResponse | TextResponse
            >,
        );

      render(
        <NotificationMethod
          setting={mockSettingSlackV2}
          index={0}
          onUpdate={mockOnUpdate}
          onRemove={mockOnRemove}
          onInputChange={mockOnInputChange}
          email_subject={mockEmailSubject}
          defaultSubject={mockDefaultSubject}
          setErrorSubject={mockSetErrorSubject}
        />,
      );

      // Wait for RefreshLabel to be rendered (it may have a tooltip with the provided content)
      const refreshLabel = await waitFor(() => screen.getByLabelText('sync'));
      // Simulate a click on the RefreshLabel
      userEvent.click(refreshLabel);
      // Verify that the SupersetClient.get was called indicating that updateSlackOptions executed
      await waitFor(() => {
        expect(supersetClientSpy).toHaveBeenCalled();
      });
    });
  });
});
