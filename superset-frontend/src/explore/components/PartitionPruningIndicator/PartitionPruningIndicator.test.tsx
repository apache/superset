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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PartitionPruningIndicator, {
  isMirroredColumn,
  isMirroredFilter,
} from '.';

const ACTIVE = {
  partition_column: 'dt_epoch',
  mapped_column: 'event_time',
  active: true,
  is_monotonic: true,
  mirrorable_operators: ['<', '<=', '==', '>', '>=', 'IN', 'TEMPORAL_RANGE'],
};

// Same mapping with a transform whose ordering the owner did not vouch for.
const NON_MONOTONIC = {
  ...ACTIVE,
  is_monotonic: false,
  mirrorable_operators: ['==', 'IN'],
};

const equalsFilter = {
  expressionType: 'SIMPLE',
  subject: 'event_time',
  operator: '==',
  comparator: '2024-01-01',
};

test('the glyph appears for an active mapping', () => {
  render(<PartitionPruningIndicator mapping={ACTIVE} />);

  expect(screen.getByTestId('partition-pruning-indicator')).toBeInTheDocument();
});

test('an inactive mapping shows nothing', () => {
  // Configured but inert -- no transform yet. Claiming the query is pruning
  // when it is not would be worse than staying quiet.
  const { container } = render(
    <PartitionPruningIndicator mapping={{ ...ACTIVE, active: false }} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('no mapping at all shows nothing', () => {
  const { container } = render(<PartitionPruningIndicator mapping={null} />);

  expect(container).toBeEmptyDOMElement();
});

test('the tooltip explains the speed-up without saying "partition column" twice', async () => {
  render(<PartitionPruningIndicator mapping={ACTIVE} />);

  await userEvent.hover(screen.getByTestId('partition-pruning-indicator'));

  expect(
    await screen.findByText(
      /also applied to a partition column for faster queries/,
    ),
  ).toBeInTheDocument();
});

test('only the mapped column counts as mirrored', () => {
  // The model allows exactly one mapped column, so every other filter on the
  // chart -- including one on the partition column itself -- gets no glyph.
  expect(isMirroredColumn(ACTIVE, 'event_time')).toBe(true);
  expect(isMirroredColumn(ACTIVE, 'country')).toBe(false);
  expect(isMirroredColumn(ACTIVE, 'dt_epoch')).toBe(false);
});

test('nothing is mirrored when the mapping is inactive or absent', () => {
  expect(isMirroredColumn({ ...ACTIVE, active: false }, 'event_time')).toBe(
    false,
  );
  expect(isMirroredColumn(null, 'event_time')).toBe(false);
  expect(isMirroredColumn(ACTIVE, undefined)).toBe(false);
});

test('a filter naming the mapped column is not mirrored on its own', () => {
  // The query path rejects negations outright: the transform need not be
  // injective, so `country != 'US'` would mirror to a predicate that drops rows
  // the original filter keeps.
  expect(isMirroredFilter(ACTIVE, equalsFilter)).toBe(true);
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, operator: '!=' })).toBe(
    false,
  );
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, operator: 'LIKE' })).toBe(
    false,
  );
  expect(
    isMirroredFilter(ACTIVE, { ...equalsFilter, subject: 'country' }),
  ).toBe(false);
});

test('range operators wait on the monotonicity declaration', () => {
  const greaterThan = { ...equalsFilter, operator: '>' };

  expect(isMirroredFilter(ACTIVE, greaterThan)).toBe(true);
  expect(isMirroredFilter(NON_MONOTONIC, greaterThan)).toBe(false);
  // Equality mirrors under any transform, monotonic or not.
  expect(isMirroredFilter(NON_MONOTONIC, equalsFilter)).toBe(true);
});

test('a free-form SQL filter is never mirrored', () => {
  // It is appended verbatim as `extras.where`; the backend never sees an
  // (operator, value) pair to mirror.
  expect(
    isMirroredFilter(ACTIVE, {
      expressionType: 'SQL',
      subject: 'event_time',
      operator: '==',
      comparator: '2024-01-01',
    }),
  ).toBe(false);
});

test('a filter with no usable value is not mirrored', () => {
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, comparator: null })).toBe(
    false,
  );
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, comparator: '' })).toBe(
    false,
  );
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      operator: 'IN',
      comparator: [],
    }),
  ).toBe(false);
  // A null inside an IN list widens the real predicate to
  // `col IS NULL OR col IN (...)`, which the mirror cannot express.
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['a', null],
    }),
  ).toBe(false);
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['a', 'b'],
    }),
  ).toBe(true);
});

test('a temporal range of "No filter" resolves to no bounds and no glyph', () => {
  const temporal = { ...equalsFilter, operator: 'TEMPORAL_RANGE' };

  expect(
    isMirroredFilter(ACTIVE, { ...temporal, comparator: 'Last week' }),
  ).toBe(true);
  expect(
    isMirroredFilter(ACTIVE, { ...temporal, comparator: 'No filter' }),
  ).toBe(false);
  expect(
    isMirroredFilter(NON_MONOTONIC, { ...temporal, comparator: 'Last week' }),
  ).toBe(false);
});
