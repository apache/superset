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
import { render, fireEvent } from '@testing-library/react';
import {
  EmptyStateBig,
  EmptyStateMedium,
  EmptyStateSmall,
  emptyStateComponent,
} from '.';

test('renders EmptyStateBig correctly', () => {
  const mockAction = jest.fn();
  const { getByText } = render(
    <EmptyStateBig
      title="Test Title"
      image="test.jpg"
      description="Test Description"
      buttonText="Click Me"
      buttonAction={mockAction}
    />,
  );

  expect(getByText('Test Title')).toBeInTheDocument();
  expect(getByText('Test Description')).toBeInTheDocument();
  expect(getByText('Click Me')).toBeInTheDocument();

  fireEvent.click(getByText('Click Me'));
  expect(mockAction).toHaveBeenCalled();
});

test('renders EmptyStateMedium correctly', () => {
  const mockAction = jest.fn();
  const { getByText } = render(
    <EmptyStateMedium
      title="Test Title"
      image="test.jpg"
      description="Test Description"
      buttonText="Click Me"
      buttonAction={mockAction}
    />,
  );

  expect(getByText('Test Title')).toBeInTheDocument();
  expect(getByText('Test Description')).toBeInTheDocument();
  expect(getByText('Click Me')).toBeInTheDocument();

  fireEvent.click(getByText('Click Me'));
  expect(mockAction).toHaveBeenCalled();
});

test('renders EmptyStateSmall correctly', () => {
  const { getByText } = render(
    <EmptyStateSmall
      title="Test Title"
      image="test.jpg"
      description="Test Description"
    />,
  );

  expect(getByText('Test Title')).toBeInTheDocument();
  expect(getByText('Test Description')).toBeInTheDocument();
});

test('renders emptyStateComponent correctly', () => {
  const { getByText } = render(emptyStateComponent(true));

  expect(getByText('No databases match your search')).toBeInTheDocument();
  expect(getByText('Manage your databases')).toBeInTheDocument();
  expect(getByText('here')).toBeInTheDocument();

  const { getByText: getByText2 } = render(emptyStateComponent(false));

  expect(getByText2('There are no databases available')).toBeInTheDocument();
  expect(getByText2('Manage your databases')).toBeInTheDocument();
  expect(getByText2('here')).toBeInTheDocument();
});
