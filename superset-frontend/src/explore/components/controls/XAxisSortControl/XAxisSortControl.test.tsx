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

import { defaultAxisSortValue } from '@superset-ui/core';
import XAxisSortControl from './XAxisSortControl';

const defaultProps = {
  description: 'x-axis sort description',
  label: 'x-axis sort label',
  xAxisSortByOptions: [],
  value: defaultAxisSortValue,
  onChange: () => undefined,
};

const setup = (overrides = {}) => (
  <XAxisSortControl {...defaultProps} {...overrides} />
);

test('renders a default XAxisSortControl', () => {
  render(setup());

  const label = defaultAxisSortValue.sortByLabel;
  expect(screen.getByText('x-axis sort label')).toBeInTheDocument();
  expect(screen.getByText(label)).toBeInTheDocument();

  userEvent.click(screen.getByText(label));
  // isAsc should be in the document and checked
  expect(screen.getByRole('checkbox')).toBeChecked();
});

test('renders a value in XAxisSortControl', () => {
  render(
    setup({
      value: {
        sortByLabel: 'foo',
        isAsc: false,
      },
      xAxisSortByOptions: [{ label: 'foo', value: 'foo' }],
    }),
  );

  expect(screen.getByText('foo (Desc)')).toBeInTheDocument();

  userEvent.click(screen.getByText('foo (Desc)'));
  // the `foo` is in the select
  expect(screen.getByText('foo')).toBeInTheDocument();
  // the checkbox should be checked.
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
