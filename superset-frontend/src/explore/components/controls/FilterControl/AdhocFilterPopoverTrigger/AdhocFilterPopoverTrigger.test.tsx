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
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterPopoverTrigger from '.';
import { CLAUSES, EXPRESSION_TYPES } from '../types';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const mockedProps = {
  adhocFilter: simpleAdhocFilter,
  options: [],
  datasource: {},
  onFilterEdit: jest.fn(),
};

test('should render', () => {
  const { container } = render(
    <AdhocFilterPopoverTrigger {...mockedProps}>
      Click
    </AdhocFilterPopoverTrigger>,
  );
  expect(container).toBeInTheDocument();
});

test('should render the Popover on click when uncontrolled', () => {
  render(
    <AdhocFilterPopoverTrigger {...mockedProps}>
      Click
    </AdhocFilterPopoverTrigger>,
  );
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  userEvent.click(screen.getByText('Click'));
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
});

test('should be visible when controlled', async () => {
  const controlledProps = {
    ...mockedProps,
    isControlledComponent: true,
    visible: true,
    togglePopover: jest.fn(),
    closePopover: jest.fn(),
  };
  render(
    <AdhocFilterPopoverTrigger {...controlledProps}>
      Click
    </AdhocFilterPopoverTrigger>,
  );

  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('should NOT be visible when controlled', () => {
  const controlledProps = {
    ...mockedProps,
    isControlledComponent: true,
    visible: false,
    togglePopover: jest.fn(),
    closePopover: jest.fn(),
  };
  render(
    <AdhocFilterPopoverTrigger {...controlledProps}>
      Click
    </AdhocFilterPopoverTrigger>,
  );
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
