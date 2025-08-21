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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { Form } from '@superset-ui/core/components';
import BasicInfoSection from './BasicInfoSection';

const defaultProps = {
  form: {} as any,
  isLoading: false,
  validationStatus: {
    basic: { hasErrors: false, errors: [], name: 'Basic' },
  },
};

test('renders name and slug fields', () => {
  render(
    <Form>
      <BasicInfoSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByTestId('dashboard-name-field')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-slug-field')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-title-input')).toBeInTheDocument();
});

test('shows required asterisk for name field', () => {
  render(
    <Form>
      <BasicInfoSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByText('*')).toBeInTheDocument();
});

test('disables inputs when loading', () => {
  render(
    <Form>
      <BasicInfoSection {...defaultProps} isLoading />
    </Form>,
  );

  expect(screen.getByTestId('dashboard-title-input')).toBeDisabled();
});

test('shows error message when name is empty and has validation errors', () => {
  const mockForm = {
    getFieldValue: jest.fn(field => (field === 'title' ? '' : 'test')),
  };

  const validationStatus = {
    basic: {
      hasErrors: true,
      errors: ['Dashboard name is required'],
      name: 'Basic',
    },
  };

  render(
    <Form>
      <BasicInfoSection
        {...defaultProps}
        form={mockForm as any}
        validationStatus={validationStatus}
      />
    </Form>,
  );

  expect(screen.getByText('Dashboard name is required')).toBeInTheDocument();
});

test('does not show error when name is provided', () => {
  const mockForm = {
    getFieldValue: jest.fn(() => 'Test Dashboard'),
  };

  const validationStatus = {
    basic: { hasErrors: true, errors: [], name: 'Basic' },
  };

  render(
    <Form>
      <BasicInfoSection
        {...defaultProps}
        form={mockForm as any}
        validationStatus={validationStatus}
      />
    </Form>,
  );

  expect(
    screen.queryByText('Dashboard name is required'),
  ).not.toBeInTheDocument();
});

test('can type in name field', async () => {
  render(
    <Form>
      <BasicInfoSection {...defaultProps} />
    </Form>,
  );

  const nameInput = screen.getByTestId('dashboard-title-input');
  await userEvent.type(nameInput, 'My Dashboard');

  expect(nameInput).toHaveValue('My Dashboard');
});
