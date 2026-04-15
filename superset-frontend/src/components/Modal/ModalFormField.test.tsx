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
import { render, screen } from 'spec/helpers/testing-library';
import { Input } from '@superset-ui/core/components';
import { ModalFormField } from './ModalFormField';

test('renders field with label and input', () => {
  render(
    <ModalFormField label="Test Field">
      <Input placeholder="Test input" />
    </ModalFormField>,
  );

  expect(screen.getByText('Test Field')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
});

test('shows required asterisk when required is true', () => {
  render(
    <ModalFormField label="Required Field" required>
      <Input />
    </ModalFormField>,
  );

  expect(screen.getByText('Required Field')).toBeInTheDocument();
  const asterisk = screen.getByText('*');
  expect(asterisk).toBeInTheDocument();
  expect(asterisk).toHaveClass('required'); // Should have required class
});

test('shows red asterisk when required field has error', () => {
  render(
    <ModalFormField label="Required Field" required error="Field is required">
      <Input />
    </ModalFormField>,
  );

  const asterisk = screen.getByText('*');
  expect(asterisk).toBeInTheDocument();
  expect(asterisk).toHaveClass('required'); // Should have required class (always red now)
});

test('renders helper text when provided', () => {
  render(
    <ModalFormField label="Field" helperText="This is helpful">
      <Input />
    </ModalFormField>,
  );

  expect(screen.getByText('This is helpful')).toBeInTheDocument();
});

test('renders error message when provided', () => {
  render(
    <ModalFormField label="Field" error="This field is invalid">
      <Input />
    </ModalFormField>,
  );

  expect(screen.getByText('This field is invalid')).toBeInTheDocument();
});

test('renders tooltip when provided', () => {
  const tooltip = <div>Tooltip content</div>;
  render(
    <ModalFormField label="Field" tooltip={tooltip}>
      <Input />
    </ModalFormField>,
  );

  // Tooltip is rendered inside InfoTooltip component
  expect(screen.getByTestId('info-tooltip-icon')).toBeInTheDocument();
});

test('applies bottomSpacing by default', () => {
  const { container } = render(
    <ModalFormField label="Field">
      <Input />
    </ModalFormField>,
  );

  const fieldContainer = container.firstChild;
  expect(fieldContainer).toHaveStyle('margin-bottom: 16px'); // theme.sizeUnit * 4
});

test('removes bottomSpacing when bottomSpacing is false', () => {
  const { container } = render(
    <ModalFormField label="Field" bottomSpacing={false}>
      <Input />
    </ModalFormField>,
  );

  const fieldContainer = container.firstChild;
  expect(fieldContainer).toHaveStyle('margin-bottom: 0px');
});

test('applies testId to container', () => {
  render(
    <ModalFormField label="Field" testId="custom-field">
      <Input />
    </ModalFormField>,
  );

  expect(screen.getByTestId('custom-field')).toBeInTheDocument();
});

test('renders both helper text and error message', () => {
  render(
    <ModalFormField
      label="Field"
      helperText="Helper text"
      error="Error message"
    >
      <Input />
    </ModalFormField>,
  );

  expect(screen.getByText('Helper text')).toBeInTheDocument();
  expect(screen.getByText('Error message')).toBeInTheDocument();
});
