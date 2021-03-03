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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { supersetTheme } from '@superset-ui/core';
import ErrorAlert from './ErrorAlert';
import { ErrorLevel, ErrorSource } from './types';

const mockedProps = {
  body: 'Error body',
  level: 'warning' as ErrorLevel,
  copyText: 'Copy text',
  subtitle: 'Error subtitle',
  title: 'Error title',
  source: 'dashboard' as ErrorSource,
};

jest.mock('../Icon', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => (
    <div data-test="icon" data-name={name} />
  ),
}));

test('should render', () => {
  const { container } = render(<ErrorAlert {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render warning icon', () => {
  render(<ErrorAlert {...mockedProps} />);
  expect(screen.getByTestId('icon')).toBeInTheDocument();
  expect(screen.getByTestId('icon')).toHaveAttribute(
    'data-name',
    'warning-solid',
  );
});

test('should render error icon', () => {
  const errorProps = {
    ...mockedProps,
    level: 'error' as ErrorLevel,
  };
  render(<ErrorAlert {...errorProps} />);
  expect(screen.getByTestId('icon')).toBeInTheDocument();
  expect(screen.getByTestId('icon')).toHaveAttribute(
    'data-name',
    'error-solid',
  );
});

test('should render the error title', () => {
  const titleProps = {
    ...mockedProps,
    source: 'explore' as ErrorSource,
  };
  render(<ErrorAlert {...titleProps} />);
  expect(screen.getByText('Error title')).toBeInTheDocument();
});

test('should render the error subtitle', () => {
  render(<ErrorAlert {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('Error subtitle')).toBeInTheDocument();
});

test('should render the error body', () => {
  render(<ErrorAlert {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('Error body')).toBeInTheDocument();
});

test('should render the See more button', () => {
  const seemoreProps = {
    ...mockedProps,
    source: 'explore' as ErrorSource,
  };
  render(<ErrorAlert {...seemoreProps} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
  expect(screen.getByText('See more')).toBeInTheDocument();
});

test('should render the modal', () => {
  render(<ErrorAlert {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Close')).toBeInTheDocument();
});

test('should NOT render the modal', () => {
  const expandableProps = {
    ...mockedProps,
    source: 'explore' as ErrorSource,
  };
  render(<ErrorAlert {...expandableProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should render the See less button', () => {
  const expandableProps = {
    ...mockedProps,
    source: 'explore' as ErrorSource,
  };
  render(<ErrorAlert {...expandableProps} />);
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('See less')).toBeInTheDocument();
  expect(screen.queryByText('See more')).not.toBeInTheDocument();
});

test('should render the Copy button', () => {
  render(<ErrorAlert {...mockedProps} />, { useRedux: true });
  const button = screen.getByText('See more');
  userEvent.click(button);
  expect(screen.getByText('Copy message')).toBeInTheDocument();
});

test('should render with warning theme', () => {
  render(<ErrorAlert {...mockedProps} />);
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
  render(<ErrorAlert {...errorProps} />);
  expect(screen.getByRole('alert')).toHaveStyle(
    `
      backgroundColor: ${supersetTheme.colors.error.light2};
    `,
  );
});
