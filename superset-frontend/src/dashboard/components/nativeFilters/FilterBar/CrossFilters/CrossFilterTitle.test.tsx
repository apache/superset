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
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { FilterBarOrientation } from 'src/dashboard/types';
import CrossFilterTitle from './CrossFilterTitle';

const mockedProps = {
  title: 'test-title',
  orientation: FilterBarOrientation.HORIZONTAL,
  onHighlightFilterSource: jest.fn(),
};

const setup = (props: typeof mockedProps) =>
  render(<CrossFilterTitle {...props} />, {
    useRedux: true,
  });

test('CrossFilterTitle should render', () => {
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('Title should be visible', () => {
  setup(mockedProps);
  expect(screen.getByText('test-title')).toBeInTheDocument();
});

test('Search icon should highlight emitter', () => {
  setup(mockedProps);
  const search = screen.getByTestId('cross-filters-highlight-emitter');
  expect(search).toBeInTheDocument();
  userEvent.click(search);
  expect(mockedProps.onHighlightFilterSource).toHaveBeenCalled();
});
