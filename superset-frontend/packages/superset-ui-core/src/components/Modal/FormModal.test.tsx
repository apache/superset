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
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@superset-ui/core/spec';
import type { FormModalProps } from './types';
import { FormItem } from '../Form';
import { Input } from '../Input';
import { FormModal } from './FormModal';

describe('FormModal Component', () => {
  const children = (
    <>
      <FormItem
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="Enter your name" aria-label="Name" />
      </FormItem>
      <FormItem name="email" label="Email">
        <Input placeholder="Enter your email" aria-label="Email" />
      </FormItem>
    </>
  );

  const mockedProps: FormModalProps = {
    show: true,
    onHide: jest.fn(),
    title: 'Test Form Modal',
    onSave: jest.fn(),
    formSubmitHandler: jest.fn().mockResolvedValue(undefined),
    initialValues: { name: '', email: '' },
    requiredFields: ['name'],
    children,
  };

  const renderComponent = () => render(<FormModal {...mockedProps} />);

  it('should render the modal with two input fields', () => {
    renderComponent();

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should disable Save button when required fields are empty', async () => {
    renderComponent();

    const saveButton = screen.getByTestId('form-modal-save-button');
    expect(saveButton).toBeDisabled();
  });

  it('should enable Save button only when the required field is filled', async () => {
    renderComponent();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    await userEvent.type(nameInput, 'Jane Doe');

    await waitFor(() => {
      expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
    });
  });

  it('should keep Save button disabled when only the optional field is filled', async () => {
    renderComponent();

    const emailInput = screen.getByPlaceholderText('Enter your email');
    await userEvent.type(emailInput, 'test@example.com');

    await waitFor(() => {
      expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
    });
  });

  it('should call formSubmitHandler with correct values when submitted', async () => {
    renderComponent();

    await userEvent.type(
      screen.getByPlaceholderText('Enter your name'),
      'Jane Doe',
    );
    await userEvent.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com',
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockedProps.formSubmitHandler).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'test@example.com',
      });
      expect(mockedProps.onSave).toHaveBeenCalled();
    });
  });
});
