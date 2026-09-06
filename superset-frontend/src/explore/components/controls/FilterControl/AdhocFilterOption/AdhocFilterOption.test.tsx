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

// A monotonic transform, so ranges mirror alongside equality.
const MONOTONIC_MAPPING = {
  partition_column: 'dt_epoch',
  mapped_column: 'value',
  active: true,
  is_monotonic: true,
  mirrorable_operators: ['<', '<=', '==', '>', '>=', 'IN', 'TEMPORAL_RANGE'],
};

const withMapping = (
  mapping: Record<string, unknown> | null,
  adhocFilter = simpleAdhocFilter,
) =>
  setup({
    ...mockedProps,
    adhocFilter,
    datasource: { partition_filter_mapping: mapping },
  });

const glyph = () => screen.queryByTestId('partition-pruning-indicator');

test('a filter on the mapped column carries the partition pruning glyph', () => {
  // Wireframe 1d: the chart author never configured any of this and only sees
  // an explanation of why the query got faster.
  render(withMapping(MONOTONIC_MAPPING));

  expect(glyph()).toBeInTheDocument();
});

test('a filter on any other column carries no glyph', () => {
  render(
    withMapping({ ...MONOTONIC_MAPPING, mapped_column: 'some_other_column' }),
  );

  expect(glyph()).not.toBeInTheDocument();
});

test('an inactive mapping leaves the chip alone', () => {
  render(withMapping({ ...MONOTONIC_MAPPING, active: false }));

  expect(glyph()).not.toBeInTheDocument();
});

test('a negated filter on the mapped column carries no glyph', () => {
  // The query path never mirrors a negation -- the transform need not be
  // injective, so `value != 10` would mirror to a predicate that drops rows the
  // original filter keeps. Labelling it would promise a speed-up the SQL does
  // not contain.
  render(
    withMapping(
      MONOTONIC_MAPPING,
      simpleAdhocFilter.duplicateWith({ operator: '!=' }),
    ),
  );

  expect(glyph()).not.toBeInTheDocument();
});

test('a range filter waits on the monotonicity declaration', () => {
  render(
    withMapping({
      ...MONOTONIC_MAPPING,
      is_monotonic: false,
      mirrorable_operators: ['==', 'IN'],
    }),
  );

  expect(glyph()).not.toBeInTheDocument();
});

test('an equality filter mirrors under a non-monotonic transform', () => {
  render(
    withMapping(
      {
        ...MONOTONIC_MAPPING,
        is_monotonic: false,
        mirrorable_operators: ['==', 'IN'],
      },
      simpleAdhocFilter.duplicateWith({ operator: '==' }),
    ),
  );

  expect(glyph()).toBeInTheDocument();
});

test('a free-form SQL filter on the mapped column carries no glyph', () => {
  // It lands in `extras.where`, where the backend sees no operator to mirror.
  render(
    withMapping(
      MONOTONIC_MAPPING,
      new AdhocFilter({
        expressionType: ExpressionTypes.Sql,
        sqlExpression: 'value > 10',
        clause: Clauses.Where,
      }),
    ),
  );

  expect(glyph()).not.toBeInTheDocument();
});

test('a filter with no comparator yet carries no glyph', () => {
  render(
    withMapping(
      MONOTONIC_MAPPING,
      simpleAdhocFilter.duplicateWith({ comparator: '' }),
    ),
  );

  expect(glyph()).not.toBeInTheDocument();
});
