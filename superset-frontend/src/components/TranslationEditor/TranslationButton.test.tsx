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
import userEvent from '@testing-library/user-event';
import TranslationButton from './TranslationButton';

const defaultProps = {
  translationCount: 3,
  onClick: jest.fn(),
};

test('renders with translation count', () => {
  render(<TranslationButton {...defaultProps} />);
  expect(screen.getByText('Translations (3)')).toBeInTheDocument();
});

test('renders zero count', () => {
  render(<TranslationButton {...defaultProps} translationCount={0} />);
  expect(screen.getByText('Translations (0)')).toBeInTheDocument();
});

test('calls onClick when clicked', async () => {
  const onClick = jest.fn();
  render(<TranslationButton {...defaultProps} onClick={onClick} />);
  await userEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('does not call onClick when disabled', async () => {
  const onClick = jest.fn();
  render(<TranslationButton {...defaultProps} onClick={onClick} disabled />);
  const button = screen.getByRole('button');
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

