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
import FilterBoxItemControl from '.';

const createProps = () => ({
  datasource: {
    columns: [],
    metrics: [],
  },
  asc: true,
  clearable: true,
  multiple: true,
  column: 'developer_type',
  label: 'Developer Type',
  metric: undefined,
  searchAllOptions: false,
  defaultValue: undefined,
  onChange: jest.fn(),
});

test('Should render', () => {
  const props = createProps();
  render(<FilterBoxItemControl {...props} />);
  expect(screen.getByTestId('FilterBoxItemControl')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('Should open modal', () => {
  const props = createProps();
  render(<FilterBoxItemControl {...props} />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Filter configuration')).toBeInTheDocument();
  expect(screen.getByText('Column')).toBeInTheDocument();
  expect(screen.getByText('Label')).toBeInTheDocument();
  expect(screen.getByText('Default')).toBeInTheDocument();
  expect(screen.getByText('Sort metric')).toBeInTheDocument();
  expect(screen.getByText('Sort ascending')).toBeInTheDocument();
  expect(screen.getByText('Allow multiple selections')).toBeInTheDocument();
  expect(screen.getByText('Search all filter options')).toBeInTheDocument();
  expect(screen.getByText('Required')).toBeInTheDocument();
});
