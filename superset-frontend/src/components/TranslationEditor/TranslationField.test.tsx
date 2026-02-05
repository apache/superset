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
import TranslationField from './TranslationField';

const defaultProps = {
  locale: 'de',
  localeName: 'German',
  value: 'Verkaufs-Dashboard',
  onChange: jest.fn(),
  onRemove: jest.fn(),
};

test('renders locale label with code', () => {
  render(<TranslationField {...defaultProps} />);
  expect(screen.getByText('German (de)')).toBeInTheDocument();
});

test('renders input with current value', () => {
  render(<TranslationField {...defaultProps} />);
  const input = screen.getByTestId('translation-input-de');
  expect(input).toHaveValue('Verkaufs-Dashboard');
});

test('calls onChange when input value changes', () => {
  const onChange = jest.fn();
  render(<TranslationField {...defaultProps} onChange={onChange} />);
  const input = screen.getByTestId('translation-input-de');
  fireEvent.change(input, { target: { value: 'Neuer Wert' } });
  expect(onChange).toHaveBeenCalledWith('Neuer Wert');
});

test('calls onRemove when delete button is clicked', async () => {
  const onRemove = jest.fn();
  render(<TranslationField {...defaultProps} onRemove={onRemove} />);
  await userEvent.click(screen.getByTestId('translation-remove-de'));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test('renders empty input when value is empty string', () => {
  render(<TranslationField {...defaultProps} value="" />);
  const input = screen.getByTestId('translation-input-de');
  expect(input).toHaveValue('');
});
