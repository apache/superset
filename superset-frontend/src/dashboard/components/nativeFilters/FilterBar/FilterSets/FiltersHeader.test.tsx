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
import FiltersHeader, { FiltersHeaderProps } from './FiltersHeader';

const mockedProps = {
  dataMask: {
    DefaultsID: {
      filterState: {
        value: 'value',
      },
    },
  },
};
const setup = (props: FiltersHeaderProps) => (
  <Provider store={mockStore}>
    <FiltersHeader {...props} />
  </Provider>
);

test('should render', () => {
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

test('should render the right number of filters', () => {
  render(setup(mockedProps));
  expect(screen.getByText('Filters (1)')).toBeInTheDocument();
});

test('should render the name and value', () => {
  render(setup(mockedProps));
  expect(screen.getByText('test:')).toBeInTheDocument();
  expect(screen.getByText('value')).toBeInTheDocument();
});
