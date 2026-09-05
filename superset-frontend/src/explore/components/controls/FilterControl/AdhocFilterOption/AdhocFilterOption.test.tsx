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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterOption, { AdhocFilterOptionProps } from '.';
import { Clauses, ExpressionTypes } from '../types';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: Clauses.Where,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source', id: 1 },
  { type: 'VARCHAR(255)', column_name: 'target', id: 2 },
  { type: 'DOUBLE', column_name: 'value', id: 3 },
];

const mockedProps = {
  adhocFilter: simpleAdhocFilter,
  onFilterEdit: jest.fn(),
  onRemoveFilter: jest.fn(),
  options,
  sections: [],
  operators: [],
  datasource: {},
  partitionColumn: '',
  onMoveLabel: jest.fn(),
  onDropLabel: jest.fn(),
  index: 1,
};

const setup = (props: AdhocFilterOptionProps) => (
  <AdhocFilterOption {...props} />
);

test('should render', async () => {
  const { container } = render(setup(mockedProps), {
    useDnd: true,
    useRedux: true,
  });
  await waitFor(() => expect(container).toBeInTheDocument());
});

test('should render the control label', async () => {
  render(setup(mockedProps), { useDnd: true, useRedux: true });
  expect(await screen.findByText('value > 10')).toBeInTheDocument();
});

test('should render the control label using the column verbose_name when one is set', async () => {
  render(
    setup({
      ...mockedProps,
      options: [
        {
          type: 'DOUBLE',
          column_name: 'value',
          verbose_name: 'total_count',
          id: 3,
        },
      ],
    }),
    { useDnd: true, useRedux: true },
  );
  expect(await screen.findByText('total_count > 10')).toBeInTheDocument();
});

test('should render the remove button', async () => {
  render(setup(mockedProps), { useDnd: true, useRedux: true });
  const removeBtn = await screen.findByTestId('remove-control-button');
  expect(removeBtn).toBeInTheDocument();
});

test('should render the right caret', async () => {
  render(setup(mockedProps), { useDnd: true, useRedux: true });
  expect(await screen.findByRole('img', { name: 'right' })).toBeInTheDocument();
});

test('should render the Popover on clicking the right caret', async () => {
  render(setup(mockedProps), { useDnd: true, useRedux: true });
  const rightCaret = await screen.findByRole('img', {
    name: 'right',
  });
  userEvent.click(rightCaret);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
});

test('a filter on the mapped column carries the partition pruning glyph', () => {
  // Wireframe 1d: the chart author never configured any of this and only sees
  // an explanation of why the query got faster.
  render(
    setup({
      ...mockedProps,
      datasource: {
        partition_filter_mapping: {
          partition_column: 'dt_epoch',
          mapped_column: 'value',
          active: true,
        },
      },
    }),
  );

  expect(screen.getByTestId('partition-pruning-indicator')).toBeInTheDocument();
});

test('a filter on any other column carries no glyph', () => {
  render(
    setup({
      ...mockedProps,
      datasource: {
        partition_filter_mapping: {
          partition_column: 'dt_epoch',
          mapped_column: 'some_other_column',
          active: true,
        },
      },
    }),
  );

  expect(
    screen.queryByTestId('partition-pruning-indicator'),
  ).not.toBeInTheDocument();
});

test('an inactive mapping leaves the chip alone', () => {
  render(
    setup({
      ...mockedProps,
      datasource: {
        partition_filter_mapping: {
          partition_column: 'dt_epoch',
          mapped_column: 'value',
          active: false,
        },
      },
    }),
  );

  expect(
    screen.queryByTestId('partition-pruning-indicator'),
  ).not.toBeInTheDocument();
});
