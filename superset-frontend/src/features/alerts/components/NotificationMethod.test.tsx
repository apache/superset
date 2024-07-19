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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

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
});
