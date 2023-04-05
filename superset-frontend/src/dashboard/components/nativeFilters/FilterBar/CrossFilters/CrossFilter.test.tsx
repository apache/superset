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
import { FilterBarOrientation } from 'src/dashboard/types';
import { IndicatorStatus } from '../../selectors';
import CrossFilter from './CrossFilter';

const mockedProps = {
  filter: {
    name: 'test',
    emitterId: 1,
    column: 'country_name',
    value: 'Italy',
    status: IndicatorStatus.CrossFilterApplied,
    path: ['test-path'],
  },
  orientation: FilterBarOrientation.HORIZONTAL,
  last: false,
};

const setup = (props: typeof mockedProps) =>
  render(<CrossFilter {...props} />, {
    useRedux: true,
  });

test('CrossFilter should render', () => {
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('Title should render', () => {
  setup(mockedProps);
  expect(screen.getByText('test')).toBeInTheDocument();
});

test('Search icon should be visible', () => {
  setup(mockedProps);
  expect(
    screen.getByTestId('cross-filters-highlight-emitter'),
  ).toBeInTheDocument();
});

test('Column and value should be visible', () => {
  setup(mockedProps);
  expect(screen.getByText('country_name')).toBeInTheDocument();
  expect(screen.getByText('Italy')).toBeInTheDocument();
});

test('Tag should be closable', () => {
  setup(mockedProps);
  expect(screen.getByRole('img', { name: 'close' })).toBeInTheDocument();
});

test('Divider should not be visible', () => {
  setup(mockedProps);
  expect(screen.queryByTestId('cross-filters-divider')).not.toBeInTheDocument();
});

test('Divider should be visible', () => {
  setup({
    ...mockedProps,
    last: true,
  });
  expect(screen.getByTestId('cross-filters-divider')).toBeInTheDocument();
});
