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
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import SupersetResourceSelect from '.';

const mockedProps = {
  resource: 'dataset',
  searchColumn: 'table_name',
  onError: () => {},
};

fetchMock.get('glob:*/api/v1/dataset/?q=*', {});

test('should render', () => {
  const { container } = render(<SupersetResourceSelect {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the Select... placeholder', () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  expect(screen.getByText('Select...')).toBeInTheDocument();
});

test('should render the Loading... message', () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('should render the No options message', async () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  expect(await screen.findByText('No options')).toBeInTheDocument();
});

test('should render the typed text', async () => {
  render(<SupersetResourceSelect {...mockedProps} />);
  const select = screen.getByText('Select...');
  userEvent.click(select);
  userEvent.type(select, 'typed text');
  expect(await screen.findByText('typed text')).toBeInTheDocument();
});
