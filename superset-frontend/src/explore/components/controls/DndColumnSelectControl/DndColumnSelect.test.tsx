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
import { FeatureFlag } from '@superset-ui/core';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import {
  DndColumnSelect,
  DndColumnSelectProps,
} from 'src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';

const defaultProps: DndColumnSelectProps = {
  type: 'DndColumnSelect',
  name: 'Filter',
  onChange: jest.fn(),
  options: [{ column_name: 'Column A' }],
  actions: { setControlValue: jest.fn() },
};

beforeAll(() => {
  window.featureFlags = { [FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP]: true };
});

afterAll(() => {
  window.featureFlags = {};
});

test('renders with default props', async () => {
  render(<DndColumnSelect {...defaultProps} />, {
    useDnd: true,
    useRedux: true,
  });
  expect(await screen.findByText('Drop columns here')).toBeInTheDocument();
});

test('renders with value', async () => {
  render(<DndColumnSelect {...defaultProps} value="Column A" />, {
    useDnd: true,
    useRedux: true,
  });
  expect(await screen.findByText('Column A')).toBeInTheDocument();
});

test('renders adhoc column', async () => {
  render(
    <DndColumnSelect
      {...defaultProps}
      value={{
        sqlExpression: 'Count *',
        label: 'adhoc column',
        expressionType: 'SQL',
      }}
    />,
    { useDnd: true, useRedux: true },
  );
  expect(await screen.findByText('adhoc column')).toBeVisible();
  expect(screen.getByLabelText('calculator')).toBeVisible();
});
