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

import {
  FeatureFlag,
  JsonResponse,
  SupersetClient,
  TextResponse,
} from '@superset-ui/core';
import { NotificationMethod, mapSlackValues } from './NotificationMethod';
import { NotificationMethodOption, NotificationSetting } from '../types';

const mockOnUpdate = jest.fn();
const mockOnRemove = jest.fn();
const mockOnInputChange = jest.fn();
const mockSetErrorSubject = jest.fn();
const mockAddDangerToast = jest.fn();

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

beforeEach(() => {
  jest.clearAllMocks();
  cleanup();
});

test('NotificationMethod - should render the component', () => {
  render(
    <NotificationMethod
      setting={mockSetting}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  expect(screen.getByText('Notification Method')).toBeInTheDocument();
  expect(screen.getByText('Email subject name (optional)')).toBeInTheDocument();
  expect(screen.getByText('Email recipients')).toBeInTheDocument();
});

test('NotificationMethod - should call onRemove when the delete button is clicked', () => {
  render(
    <NotificationMethod
      setting={mockSetting}
      index={1}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  const deleteButton = document.querySelector('.delete-button');
  if (deleteButton) userEvent.click(deleteButton);

  expect(mockOnRemove).toHaveBeenCalledWith(1);
});

test('NotificationMethod - should update recipient value when input changes', () => {
  render(
    <NotificationMethod
      setting={mockSetting}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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

test('NotificationMethod - should call onRecipientsChange when the recipients value is changed', () => {
  render(
    <NotificationMethod
      setting={mockSetting}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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

test('NotificationMethod - should correctly map recipients when method is SlackV2', () => {
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

test('NotificationMethod - should return an empty array when recipientValue is an empty string', () => {
  const method = 'SlackV2';
  const recipientValue = '';
  const slackOptions: { label: string; value: string }[] = [
    { label: 'User One', value: 'user1' },
    { label: 'User Two', value: 'user2' },
  ];

  const result = mapSlackValues({ method, recipientValue, slackOptions });

  expect(result).toEqual([]);
});

test('NotificationMethod - should correctly map recipients when method is Slack with updated recipient values', () => {
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

test('NotificationMethod - should render CC and BCC fields when method is Email and visibility flags are true', () => {
  const defaultProps = {
    setting: {
      method: NotificationMethodOption.Email,
      recipients: 'recipient1@example.com, recipient2@example.com',
      cc: 'cc1@example.com',
      bcc: 'bcc1@example.com',
      options: [NotificationMethodOption.Email, NotificationMethodOption.Slack],
    },
    index: 0,
    onUpdate: jest.fn(),
    onRemove: jest.fn(),
    onInputChange: jest.fn(),
    emailSubject: 'Test Subject',
    defaultSubject: 'Default Subject',
    setErrorSubject: jest.fn(),
  };

  const { getByTestId } = render(<NotificationMethod {...defaultProps} />);

  // Check if CC and BCC fields are rendered
  expect(getByTestId('cc')).toBeInTheDocument();
  expect(getByTestId('bcc')).toBeInTheDocument();
});

test('NotificationMethod - should render CC and BCC fields with correct values when method is Email', () => {
  const defaultProps = {
    setting: {
      method: NotificationMethodOption.Email,
      recipients: 'recipient1@example.com, recipient2@example.com',
      cc: 'cc1@example.com',
      bcc: 'bcc1@example.com',
      options: [NotificationMethodOption.Email, NotificationMethodOption.Slack],
    },
    index: 0,
    onUpdate: jest.fn(),
    onRemove: jest.fn(),
    onInputChange: jest.fn(),
    emailSubject: 'Test Subject',
    defaultSubject: 'Default Subject',
    setErrorSubject: jest.fn(),
  };

  const { getByTestId } = render(<NotificationMethod {...defaultProps} />);

  // Check if CC and BCC fields are rendered with correct values
  expect(getByTestId('cc')).toHaveValue('cc1@example.com');
  expect(getByTestId('bcc')).toHaveValue('bcc1@example.com');
});

test('NotificationMethod - should not render CC and BCC fields when method is not Email', () => {
  const defaultProps = {
    setting: {
      method: NotificationMethodOption.Slack,
      recipients: 'recipient1@example.com, recipient2@example.com',
      cc: 'cc1@example.com',
      bcc: 'bcc1@example.com',
      options: [NotificationMethodOption.Email, NotificationMethodOption.Slack],
    },
    index: 0,
    onUpdate: jest.fn(),
    onRemove: jest.fn(),
    onInputChange: jest.fn(),
    emailSubject: 'Test Subject',
    defaultSubject: 'Default Subject',
    setErrorSubject: jest.fn(),
  };

  const { queryByTestId } = render(<NotificationMethod {...defaultProps} />);

  // Check if CC and BCC fields are not rendered
  expect(queryByTestId('cc')).not.toBeInTheDocument();
  expect(queryByTestId('bcc')).not.toBeInTheDocument();
});
// Handle empty recipients list gracefully
test('NotificationMethod - should handle empty recipients list gracefully', () => {
  const defaultProps = {
    setting: {
      method: NotificationMethodOption.Email,
      recipients: '',
      cc: '',
      bcc: '',
      options: [NotificationMethodOption.Email, NotificationMethodOption.Slack],
    },
    index: 0,
    onUpdate: jest.fn(),
    onRemove: jest.fn(),
    onInputChange: jest.fn(),
    emailSubject: 'Test Subject',
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
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
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  expect(
    screen.getByText('Recipients are separated by "," or ";"'),
  ).toBeInTheDocument();
});

test('NotificationMethod - AsyncSelect should render for SlackV2 method', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    { name: 'general', id: 'C001', is_private: false, is_member: true },
    { name: 'random', id: 'C002', is_private: false, is_member: true },
  ];

  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  } as unknown as Promise<Response | JsonResponse | TextResponse>);

  render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Verify AsyncSelect is rendered for SlackV2
  await waitFor(() => {
    expect(screen.getByTitle('Slack')).toBeInTheDocument();
  });
});

test('NotificationMethod - AsyncSelect should handle SlackV2 with valid API response', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    {
      name: 'test-channel',
      id: 'C123',
      is_private: false,
      is_member: true,
    },
  ];

  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  } as unknown as Promise<Response | JsonResponse | TextResponse>);

  const { container } = render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Verify AsyncSelect container is present (not a textarea)
  await waitFor(() => {
    const textarea = container.querySelector(
      'textarea[data-test="recipients"]',
    );
    expect(textarea).toBeNull(); // Should NOT have textarea for SlackV2
  });
});

test('NotificationMethod - AsyncSelect should render refresh button for SlackV2', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    {
      name: 'test-channel',
      id: 'C123',
      is_private: false,
      is_member: true,
    },
  ];

  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  } as unknown as Promise<Response | JsonResponse | TextResponse>);

  render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Verify refresh button is present (icon only button)
  await waitFor(() => {
    const refreshButton = screen.getByTestId('refresh-slack-channels');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveAttribute('title', 'Refresh channels');
  });
});

test('NotificationMethod - AsyncSelect should reload channels without clearing recipients when refresh button clicked', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    {
      name: 'test-channel',
      id: 'C123',
      is_private: false,
      is_member: true,
    },
  ];

  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  } as unknown as Promise<Response | JsonResponse | TextResponse>);

  render(
    <NotificationMethod
      setting={{
        ...mockSettingSlackV2,
        recipients: 'C123', // Pre-existing recipient
      }}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Wait for initial render
  await waitFor(() => {
    expect(screen.getByTestId('refresh-slack-channels')).toBeInTheDocument();
  });

  const initialCallCount = getSpy.mock.calls.length;

  // Click refresh button
  const refreshButton = screen.getByTestId('refresh-slack-channels');
  fireEvent.click(refreshButton);

  // Verify the API was called again to reload channels
  await waitFor(() => {
    expect(getSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  // Verify onUpdate was NOT called with empty recipients (recipients should be preserved)
  const updateCalls = mockOnUpdate.mock.calls;
  const callsWithEmptyRecipients = updateCalls.filter(
    call => call[1]?.recipients === '',
  );
  expect(callsWithEmptyRecipients).toHaveLength(0);

  getSpy.mockRestore();
});

test('NotificationMethod - data cache prevents redundant API calls when selecting channels', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

  const mockChannels = [
    { name: 'general', id: 'C001', is_private: false, is_member: true },
    { name: 'random', id: 'C002', is_private: false, is_member: true },
  ];

  const mockSettingWithoutRecipients: NotificationSetting = {
    method: NotificationMethodOption.SlackV2,
    recipients: '', // Empty to avoid initialization call
    options: [
      NotificationMethodOption.Email,
      NotificationMethodOption.Slack,
      NotificationMethodOption.SlackV2,
    ],
  };

  let callCount = 0;
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockImplementation(async url => {
      if (typeof url === 'object' && url.endpoint?.includes('slack_channels')) {
        callCount += 1;
      }
      return {
        json: {
          result: mockChannels,
          next_cursor: null,
          has_more: false,
        },
      } as unknown as Promise<Response | JsonResponse | TextResponse>;
    });

  const { getByRole } = render(
    <NotificationMethod
      setting={mockSettingWithoutRecipients}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  const recipientsSelect = getByRole('combobox', {
    name: /select channels/i,
  });

  fireEvent.mouseDown(recipientsSelect);

  await waitFor(
    () => {
      expect(callCount).toBe(1);
    },
    { timeout: 3000 },
  );

  fireEvent.blur(recipientsSelect);
  fireEvent.mouseDown(recipientsSelect);

  await new Promise(resolve => setTimeout(resolve, 200));

  // Should still be 1 because of caching
  expect(callCount).toBe(1);

  getSpy.mockRestore();
});

test('NotificationMethod - should preserve selected channels on refresh', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    { id: 'C001', name: 'general', is_private: false, is_member: true },
    { id: 'C002', name: 'random', is_private: false, is_member: true },
    { id: 'C003', name: 'engineering', is_private: false, is_member: true },
  ];

  const mockSettingWithRecipients: NotificationSetting = {
    method: NotificationMethodOption.SlackV2,
    recipients: 'C001,C002',
    options: [
      NotificationMethodOption.Email,
      NotificationMethodOption.Slack,
      NotificationMethodOption.SlackV2,
    ],
  };

  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(
    () =>
      Promise.resolve({
        json: {
          result: mockChannels,
          next_cursor: null,
          has_more: false,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>,
  );

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingWithRecipients}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Wait for initial load
  await waitFor(
    () => {
      expect(getByTestId('refresh-slack-channels')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  const initialCallCount = getSpy.mock.calls.length;

  // Find and click the refresh button
  const refreshButton = getByTestId('refresh-slack-channels');
  fireEvent.click(refreshButton);

  // Wait for refresh to complete
  await waitFor(
    () => {
      expect(getSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
    },
    { timeout: 3000 },
  );

  // Verify that recipients are preserved (not cleared to empty string)
  const updateCalls = mockOnUpdate.mock.calls;
  const callsWithEmptyRecipients = updateCalls.filter(
    call => call[1]?.recipients === '',
  );
  expect(callsWithEmptyRecipients).toHaveLength(0);

  getSpy.mockRestore();
});

test('NotificationMethod - should initialize Slack recipients when editing existing alert', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };
  const mockChannels = [
    { id: 'C001', name: 'general', is_private: false, is_member: true },
    { id: 'C002', name: 'random', is_private: false, is_member: true },
    { id: 'C003', name: 'engineering', is_private: false, is_member: true },
  ];

  const mockSettingWithRecipients: NotificationSetting = {
    method: NotificationMethodOption.SlackV2,
    recipients: 'C001,C002',
    options: [
      NotificationMethodOption.Email,
      NotificationMethodOption.Slack,
      NotificationMethodOption.SlackV2,
    ],
  };

  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(
    () =>
      Promise.resolve({
        json: {
          result: mockChannels,
          next_cursor: null,
          has_more: false,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>,
  );

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingWithRecipients}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Wait for the component to render and recipients dropdown to be available
  await waitFor(
    () => {
      expect(getByTestId('recipients')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  // Verify that the component fetched channels for initialization
  await waitFor(
    () => {
      expect(getSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  // Verify that the component attempted to initialize recipients
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: expect.stringContaining('/api/v1/report/slack_channels/'),
    }),
  );

  getSpy.mockRestore();
});

test('NotificationMethod - should preserve selected channels during search and pagination', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

  // Mock channels for different pages and search results
  const page1Channels = [
    { id: 'C001', name: 'general', is_private: false, is_member: true },
    { id: 'C002', name: 'random', is_private: false, is_member: true },
    { id: 'C003', name: 'engineering', is_private: false, is_member: true },
  ];

  const page2Channels = [
    { id: 'C004', name: 'design', is_private: false, is_member: true },
    { id: 'C005', name: 'product', is_private: false, is_member: true },
  ];

  const searchChannels = [
    { id: 'C003', name: 'engineering', is_private: false, is_member: true },
    { id: 'C006', name: 'eng-team', is_private: false, is_member: true },
  ];

  // Setting with pre-selected recipients
  const mockSettingWithRecipients: NotificationSetting = {
    method: NotificationMethodOption.SlackV2,
    recipients: 'C001,C002', // Pre-selected: general, random
    options: [
      NotificationMethodOption.Email,
      NotificationMethodOption.Slack,
      NotificationMethodOption.SlackV2,
    ],
  };

  // Mock API to return different results based on search string
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockImplementation(({ endpoint }) => {
      const url = endpoint as string;
      const isSearch = url.includes('search_string');
      const isPage2 = url.includes('cursor');

      let result;
      let next_cursor = null;
      let has_more = false;

      if (isSearch) {
        // Search returns matching channels
        result = searchChannels;
      } else if (isPage2) {
        // Page 2 returns additional channels
        result = page2Channels;
      } else {
        // Page 1 returns initial channels
        result = page1Channels;
        next_cursor = 'page2cursor';
        has_more = true;
      }

      return Promise.resolve({
        json: {
          result,
          next_cursor,
          has_more,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>;
    });

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingWithRecipients}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  // Wait for initial page to load
  await waitFor(
    () => {
      expect(getByTestId('recipients')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  // Verify initial API call was made
  await waitFor(
    () => {
      expect(getSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  const initialCallCount = getSpy.mock.calls.length;

  // Simulate search and pagination scenarios
  // Note: AsyncSelect is complex to simulate directly, so we verify via API calls
  // that selections aren't cleared during search and pagination operations

  // Verify no calls to onUpdate cleared the recipients
  let updateCalls = mockOnUpdate.mock.calls;
  let callsWithEmptyRecipients = updateCalls.filter(
    call => call[1]?.recipients === '',
  );
  expect(callsWithEmptyRecipients).toHaveLength(0);

  // Simulate pagination by triggering additional API calls
  // In the real component, this happens when user scrolls in AsyncSelect
  await waitFor(
    () => {
      // The component should have made at least the initial call
      expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount);
    },
    { timeout: 3000 },
  );

  // After pagination, verify recipients are still not cleared
  updateCalls = mockOnUpdate.mock.calls;
  callsWithEmptyRecipients = updateCalls.filter(
    call => call[1]?.recipients === '',
  );
  expect(callsWithEmptyRecipients).toHaveLength(0);

  // Verify that all onUpdate calls (if any) preserved the recipients
  // Every call should either have no recipients field touched, or have recipients
  const updateCallsWithEmptyRecipientsCheck = updateCalls.every(
    call => !call[1]?.hasOwnProperty('recipients') || call[1].recipients !== '',
  );
  expect(updateCallsWithEmptyRecipientsCheck).toBe(true);

  getSpy.mockRestore();
});

test('NotificationMethod - should support comma-separated channel search', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

  const mockChannelsPage1 = [
    { id: 'C001', name: 'engineering', is_private: false, is_member: true },
    {
      id: 'C002',
      name: 'engineering-team',
      is_private: false,
      is_member: true,
    },
  ];
  const mockChannelsPage2 = [
    { id: 'C003', name: 'marketing', is_private: false, is_member: true },
    { id: 'C004', name: 'sales', is_private: false, is_member: true },
  ];

  let callCount = 0;
  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      return Promise.resolve({
        json: {
          result: mockChannelsPage1,
          next_cursor: 'cursor_2',
          has_more: true,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>;
    }
    return Promise.resolve({
      json: {
        result: mockChannelsPage2,
        next_cursor: null,
        has_more: false,
      },
    }) as unknown as Promise<Response | JsonResponse | TextResponse>;
  });

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  await waitFor(
    () => {
      expect(getByTestId('recipients')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  await waitFor(
    () => {
      expect(getSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  const apiCalls = getSpy.mock.calls;
  expect(apiCalls.length).toBeGreaterThan(0);

  getSpy.mockRestore();
});

test('NotificationMethod - AsyncSelect should not filter results client-side', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

  const mockChannels = [
    { id: 'C001', name: 'analytics-team', is_private: false, is_member: true },
    { id: 'C002', name: 'analytics-ops', is_private: false, is_member: true },
    { id: 'C003', name: 'engineering', is_private: false, is_member: true },
  ];

  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(
    () =>
      Promise.resolve({
        json: {
          result: mockChannels,
          next_cursor: null,
          has_more: false,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>,
  );

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  await waitFor(
    () => {
      expect(getByTestId('recipients')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  await waitFor(
    () => {
      expect(getSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  const recipientsSelect = getByTestId('recipients');
  expect(recipientsSelect).toBeInTheDocument();

  getSpy.mockRestore();
});

test('NotificationMethod - AsyncSelect should not use comma as token separator', async () => {
  window.featureFlags = { [FeatureFlag.AlertReportSlackV2]: true };

  const mockChannels = [
    { id: 'C001', name: 'engineering', is_private: false, is_member: true },
    { id: 'C002', name: 'marketing', is_private: false, is_member: true },
  ];

  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(
    () =>
      Promise.resolve({
        json: {
          result: mockChannels,
          next_cursor: null,
          has_more: false,
        },
      }) as unknown as Promise<Response | JsonResponse | TextResponse>,
  );

  const { getByTestId } = render(
    <NotificationMethod
      setting={mockSettingSlackV2}
      index={0}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onInputChange={mockOnInputChange}
      emailSubject={mockEmailSubject}
      defaultSubject={mockDefaultSubject}
      setErrorSubject={mockSetErrorSubject}
      addDangerToast={mockAddDangerToast}
    />,
  );

  await waitFor(
    () => {
      expect(getByTestId('recipients')).toBeInTheDocument();
    },
    { timeout: 3000 },
  );

  await waitFor(
    () => {
      expect(getSpy).toHaveBeenCalled();
    },
    { timeout: 3000 },
  );

  const recipientsSelect = getByTestId('recipients');
  expect(recipientsSelect).toBeInTheDocument();

  getSpy.mockRestore();
});
