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

describe('NotificationMethod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  it('should render the component', () => {
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

  it('should call onRemove when the delete button is clicked', () => {
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

  it('should update recipient value when input changes', () => {
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

  it('should call onRecipientsChange when the recipients value is changed', () => {
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

  it('should correctly map recipients when method is SlackV2', () => {
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

  it('should return an empty array when recipientValue is an empty string', () => {
    const method = 'SlackV2';
    const recipientValue = '';
    const slackOptions: { label: string; value: string }[] = [
      { label: 'User One', value: 'user1' },
      { label: 'User Two', value: 'user2' },
    ];

    const result = mapSlackValues({ method, recipientValue, slackOptions });

    expect(result).toEqual([]);
  });

  it('should correctly map recipients when method is Slack with updated recipient values', () => {
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
  it('should render CC and BCC fields when method is Email and visibility flags are true', () => {
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
  it('should render CC and BCC fields with correct values when method is Email', () => {
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
  it('should not render CC and BCC fields when method is not Email', () => {
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
  it('should handle empty recipients list gracefully', () => {
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
  it('shows the right combo when ff is false', async () => {
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
  it('shows the textbox when the fetch fails', async () => {
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
  it('shows the dropdown when ff is true and slackChannels succeed', async () => {
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
  it('shows the textarea when ff is true and slackChannels fail', async () => {
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
  it('shows the textarea when ff is true and slackChannels fail and slack is selected', async () => {
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
});
