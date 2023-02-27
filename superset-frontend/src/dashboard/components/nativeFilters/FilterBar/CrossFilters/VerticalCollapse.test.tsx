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
import { IndicatorStatus } from '../../selectors';
import VerticalCollapse from './VerticalCollapse';

const mockedProps = {
  crossFilters: [
    {
      name: 'test',
      emitterId: 1,
      column: 'country_name',
      value: 'Italy',
      status: IndicatorStatus.CrossFilterApplied,
      path: ['test-path'],
    },
    {
      name: 'test-b',
      emitterId: 2,
      column: 'country_code',
      value: 'IT',
      status: IndicatorStatus.CrossFilterApplied,
      path: ['test-path-2'],
    },
  ],
};

const setup = (props: typeof mockedProps) =>
  render(<VerticalCollapse {...props} />, {
    useRedux: true,
  });

test('VerticalCollapse should render', () => {
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('Collapse with title should render', () => {
  setup(mockedProps);
  expect(screen.getByText('Cross-filters')).toBeInTheDocument();
});

test('Collapse should not render when empty', () => {
  setup({
    crossFilters: [],
  });
  expect(screen.queryByText('Cross-filters')).not.toBeInTheDocument();
  expect(screen.queryByText('test')).not.toBeInTheDocument();
  expect(screen.queryByText('test-b')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('cross-filters-highlight-emitter'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'close' })).not.toBeInTheDocument();
  expect(screen.queryByText('country_name')).not.toBeInTheDocument();
  expect(screen.queryByText('Italy')).not.toBeInTheDocument();
  expect(screen.queryByText('country_code')).not.toBeInTheDocument();
  expect(screen.queryByText('IT')).not.toBeInTheDocument();
  expect(screen.queryByTestId('cross-filters-divider')).not.toBeInTheDocument();
});

test('Titles should be visible', () => {
  setup(mockedProps);
  expect(screen.getByText('test')).toBeInTheDocument();
  expect(screen.getByText('test-b')).toBeInTheDocument();
});

test('Search icons should be visible', () => {
  setup(mockedProps);
  expect(screen.getAllByTestId('cross-filters-highlight-emitter')).toHaveLength(
    2,
  );
});

test('Tags should be visible', () => {
  setup(mockedProps);
  expect(screen.getByText('country_name')).toBeInTheDocument();
  expect(screen.getByText('Italy')).toBeInTheDocument();
  expect(screen.getByText('country_code')).toBeInTheDocument();
  expect(screen.getByText('IT')).toBeInTheDocument();
});

test('Tags should be closable', () => {
  setup(mockedProps);
  expect(screen.getAllByRole('img', { name: 'close' })).toHaveLength(2);
});

test('Divider should be visible', () => {
  setup(mockedProps);
  expect(screen.getByTestId('cross-filters-divider')).toBeInTheDocument();
});
