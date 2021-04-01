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
import { mockStore } from 'spec/fixtures/mockStore';
import { Provider } from 'react-redux';
import FilterSets, { FilterSetsProps } from '.';

const mockedProps = {
  disabled: false,
  isFilterSetChanged: false,
  dataMaskSelected: {
    'filter-id': {
      currentState: {
        value: [],
      },
    },
  },
  onEditFilterSet: jest.fn(),
  onFilterSelectionChange: jest.fn(),
};

const setup = (props: FilterSetsProps) => (
  <Provider store={mockStore}>
    <FilterSets {...props} />
  </Provider>
);

test('should render', () => {
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the default title', () => {
  render(setup(mockedProps));
  expect(screen.getByText('New filter set')).toBeInTheDocument();
});

test('should render the right number of filters', () => {
  render(setup(mockedProps));
  expect(screen.getByText('Filters (1)')).toBeInTheDocument();
});

test('should render the filters', () => {
  render(setup(mockedProps));
  expect(screen.getByText('Set name')).toBeInTheDocument();
});
