/*
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

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FallbackProps } from 'react-error-boundary';
import { ThemeProvider, supersetTheme } from '../../../src/style';

import FallbackComponent from '../../../src/chart/components/FallbackComponent';

const renderWithTheme = (props: FallbackProps) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <FallbackComponent {...props} />
    </ThemeProvider>,
  );

const ERROR = new Error('CaffeineOverLoadException');
const STACK_TRACE = 'Error at line 1: x.drink(coffee)';

test('renders error and stack trace', () => {
  const { getByText } = renderWithTheme({
    componentStack: STACK_TRACE,
    error: ERROR,
  });
  expect(getByText('Error: CaffeineOverLoadException')).toBeInTheDocument();
  expect(getByText('Error at line 1: x.drink(coffee)')).toBeInTheDocument();
});

test('renders error only', () => {
  const { getByText } = renderWithTheme({ error: ERROR });
  expect(getByText('Error: CaffeineOverLoadException')).toBeInTheDocument();
});

test('renders stacktrace only', () => {
  const { getByText } = renderWithTheme({ componentStack: STACK_TRACE });
  expect(getByText('Unknown Error')).toBeInTheDocument();
  expect(getByText('Error at line 1: x.drink(coffee)')).toBeInTheDocument();
});

test('renders when nothing is given', () => {
  const { getByText } = renderWithTheme({});
  expect(getByText('Unknown Error')).toBeInTheDocument();
});
