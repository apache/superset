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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import { ErrorLevel, ErrorTypeEnum } from 'src/components/ErrorMessage/types';
import MarshmallowErrorMessage from './MarshmallowErrorMessage';

describe('MarshmallowErrorMessage', () => {
  const mockError = {
    extra: {
      messages: {
        name: ["can't be blank"],
        age: {
          inner: ['is too low'],
        },
      },
      payload: {
        name: '',
        age: {
          inner: 10,
        },
      },
      issue_codes: [],
    },
    message: 'Validation failed',
    error_type: ErrorTypeEnum.MARSHMALLOW_ERROR,
    level: 'error' as ErrorLevel,
  };

  test('renders without crashing', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <MarshmallowErrorMessage error={mockError} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Validation failed')).toBeInTheDocument();
  });

  test('renders the provided subtitle', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <MarshmallowErrorMessage error={mockError} subtitle="Error Alert" />
      </ThemeProvider>,
    );
    expect(screen.getByText('Error Alert')).toBeInTheDocument();
  });

  test('renders extracted invalid values', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <MarshmallowErrorMessage error={mockError} />
      </ThemeProvider>,
    );
    expect(screen.getByText("can't be blank:")).toBeInTheDocument();
    expect(screen.getByText('is too low: 10')).toBeInTheDocument();
  });

  test('renders the JSONTree when details are expanded', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <MarshmallowErrorMessage error={mockError} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('"can\'t be blank"')).toBeInTheDocument();
  });
});
