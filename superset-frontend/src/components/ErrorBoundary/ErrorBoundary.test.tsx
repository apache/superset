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
import ErrorBoundary from '.';

const mockedProps = {
  children: <span>Error children</span>,
  onError: () => null,
  showMessage: false,
};

const Child = () => {
  throw new Error('Thrown error');
};

test('should render', () => {
  const { container } = render(
    <ErrorBoundary {...mockedProps}>
      <Child />
    </ErrorBoundary>,
  );
  expect(container).toBeInTheDocument();
});

test('should not render an error message', () => {
  render(
    <ErrorBoundary {...mockedProps}>
      <Child />
    </ErrorBoundary>,
  );
  expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
});

test('should render an error message', () => {
  const messageProps = {
    ...mockedProps,
    showMessage: true,
  };
  render(
    <ErrorBoundary {...messageProps}>
      <Child />
    </ErrorBoundary>,
  );
  expect(screen.getByText('Unexpected error')).toBeInTheDocument();
});
