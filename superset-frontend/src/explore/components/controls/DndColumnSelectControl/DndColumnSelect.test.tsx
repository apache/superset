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
import { render, screen, within } from 'spec/helpers/testing-library';
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

test('renders with default props', async () => {
  render(<DndColumnSelect {...defaultProps} />, {
    useDnd: true,
    useRedux: true,
  });
  expect(
    await screen.findByText('Drop columns here or click'),
  ).toBeInTheDocument();
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

test('warn selected custom metric when metric gets removed from dataset', async () => {
  const columnValues = ['column1', 'column2'];

  const { rerender, container } = render(
    <DndColumnSelect
      {...defaultProps}
      options={[
        {
          column_name: 'column1',
        },
        {
          column_name: 'column2',
        },
      ]}
      value={columnValues}
    />,
    {
      useDnd: true,
      useRedux: true,
    },
  );

  rerender(
    <DndColumnSelect
      {...defaultProps}
      options={[
        {
          column_name: 'column3',
        },
        {
          column_name: 'column2',
        },
      ]}
      value={columnValues}
    />,
  );
  expect(screen.getByText('column2')).toBeVisible();
  expect(screen.queryByText('column1')).toBeInTheDocument();
  const warningIcon = within(
    screen.getByText('column1').parentElement ?? container,
  ).getByRole('button');
  expect(warningIcon).toBeInTheDocument();
  userEvent.hover(warningIcon);
  const warningTooltip = await screen.findByText(
    'This column might be incompatible with current dataset',
  );
  expect(warningTooltip).toBeInTheDocument();
});
