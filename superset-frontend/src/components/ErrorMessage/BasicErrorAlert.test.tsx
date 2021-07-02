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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { supersetTheme } from '@superset-ui/core';
import BasicErrorAlert from './BasicErrorAlert';
import { ErrorLevel } from './types';

const mockedProps = {
  body: 'Error body',
  level: 'warning' as ErrorLevel,
  title: 'Error title',
};

jest.mock('../Icon', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => (
    <div data-test="icon" data-name={name} />
  ),
}));

test('should render', () => {
  const { container } = render(<BasicErrorAlert {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render warning icon', () => {
  render(<BasicErrorAlert {...mockedProps} />);
  expect(
    screen.getByRole('img', { name: 'warning-solid' }),
  ).toBeInTheDocument();
});

test('should render error icon', () => {
  const errorProps = {
    ...mockedProps,
    level: 'error' as ErrorLevel,
  };
  render(<BasicErrorAlert {...errorProps} />);
  expect(screen.getByRole('img', { name: 'error-solid' })).toBeInTheDocument();
});

test('should render the error title', () => {
  render(<BasicErrorAlert {...mockedProps} />);
  expect(screen.getByText('Error title')).toBeInTheDocument();
});

test('should render the error body', () => {
  render(<BasicErrorAlert {...mockedProps} />);
  expect(screen.getByText('Error body')).toBeInTheDocument();
});

test('should render with warning theme', () => {
  render(<BasicErrorAlert {...mockedProps} />);
  expect(screen.getByRole('alert')).toHaveStyle(
    `
      backgroundColor: ${supersetTheme.colors.warning.light2};
    `,
  );
});

test('should render with error theme', () => {
  const errorProps = {
    ...mockedProps,
    level: 'error' as ErrorLevel,
  };
  render(<BasicErrorAlert {...errorProps} />);
  expect(screen.getByRole('alert')).toHaveStyle(
    `
      backgroundColor: ${supersetTheme.colors.error.light2};
    `,
  );
});
