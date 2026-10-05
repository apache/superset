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
  // An empty string is *not* excluded: the backend's mirror collector skips
  // only `None`, so `col = ''` mirrors and hiding the glyph contradicted the
  // SQL it stands next to.
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, comparator: '' })).toBe(
    true,
  );
  // `<NULL>` is the sentinel Explore writes for a real NULL, which
  // `filter_values_handler` converts back to `None` server-side -- so it is as
  // unmirrorable as `null`, by the same rule.
  expect(
    isMirroredFilter(ACTIVE, { ...equalsFilter, comparator: '<NULL>' }),
  ).toBe(false);
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['a', '<NULL>'],
    }),
  ).toBe(false);
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

test('a filter carrying a time grain is not mirrored', () => {
  // Drill-to-detail sends `==` on a bucket start plus the chart's grain, so the
  // real predicate compares the truncated column and every row in the bucket
  // matches. `_collect_partition_mirror_filter` is skipped entirely for those,
  // so the glyph would promise pruning the query does not do.
  expect(isMirroredFilter(ACTIVE, { ...equalsFilter, grain: 'P1W' })).toBe(
    false,
  );
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['a'],
      grain: 'P1D',
    }),
  ).toBe(false);
});

test('a grained time range still mirrors, by widening its bounds', () => {
  // The one grained case the query path does mirror -- both bounds are widened
  // by a bucket, which is never narrower than the truncated predicate.
  expect(
    isMirroredFilter(ACTIVE, {
      expressionType: 'SIMPLE',
      subject: 'event_time',
      operator: 'TEMPORAL_RANGE',
      comparator: 'Last week',
      grain: 'P1W',
    }),
  ).toBe(true);
});

test('the glyph explains itself to a keyboard user', async () => {
  // The glyph's only explanation is its tooltip, so without a tab stop and an
  // accessible name there was no way to discover why it is there.
  render(<PartitionPruningIndicator mapping={ACTIVE} />);

  const glyph = screen.getByRole('button', {
    name: /also applied to a partition column/,
  });

  await userEvent.tab();
  expect(glyph).toHaveFocus();
});

test('an equality carrying a time of day is not mirrored at day resolution', () => {
  // The engine compares a DATE column on its date part alone, so the filter
  // keeps the whole day while a mirror derived from the time keeps one instant
  // of it. The query path declines rather than emit something narrower than the
  // filter, and the glyph has to say the same thing.
  const DAY = { ...ACTIVE, literal_resolution: 'day' as const };

  expect(
    isMirroredFilter(DAY, {
      ...equalsFilter,
      comparator: '2024-01-01 10:08:11',
    }),
  ).toBe(false);
  expect(
    isMirroredFilter(DAY, { ...equalsFilter, comparator: '2024-01-01T10:08' }),
  ).toBe(false);
  expect(
    isMirroredFilter(DAY, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['2024-01-01', '2024-01-02 09:00:00'],
    }),
  ).toBe(false);
});

test('a date, or a date at midnight, still mirrors at day resolution', () => {
  // The decline is about a *lost* time of day, not about DATE columns: where the
  // value sits on the day boundary the engine's comparison and the mirror's
  // value agree.
  const DAY = { ...ACTIVE, literal_resolution: 'day' as const };

  expect(isMirroredFilter(DAY, equalsFilter)).toBe(true);
  expect(
    isMirroredFilter(DAY, {
      ...equalsFilter,
      comparator: '2024-01-01T00:00:00',
    }),
  ).toBe(true);
  expect(
    isMirroredFilter(DAY, {
      ...equalsFilter,
      operator: 'IN',
      comparator: ['2024-01-01', '2024-01-02'],
    }),
  ).toBe(true);
});

test('a range at day resolution still mirrors, by widening to the day', () => {
  // A bound has somewhere to widen to where an equality does not, so the glyph
  // stays on it.
  const DAY = { ...ACTIVE, literal_resolution: 'day' as const };

  expect(
    isMirroredFilter(DAY, {
      ...equalsFilter,
      operator: '>=',
      comparator: '2024-01-01 10:08:11',
    }),
  ).toBe(true);
});

test('a value the pattern cannot read keeps the glyph', () => {
  // Matching the server's `datetime.fromisoformat` acceptance set in the browser
  // is not achievable, so the pattern only ever fires on a value the server
  // certainly declines. Everything else falls back to the advisory behaviour.
  const DAY = { ...ACTIVE, literal_resolution: 'day' as const };

  expect(
    isMirroredFilter(DAY, { ...equalsFilter, comparator: '01/01/2024 10:08' }),
  ).toBe(true);
  expect(
    isMirroredFilter(DAY, { ...equalsFilter, comparator: 1704103691000 }),
  ).toBe(true);
});

test('a summary with no resolution, or full resolution, is unaffected', () => {
  // Every engine that compares the whole value, which is most of them.
  expect(
    isMirroredFilter(ACTIVE, {
      ...equalsFilter,
      comparator: '2024-01-01 10:08:11',
    }),
  ).toBe(true);
  expect(
    isMirroredFilter(
      { ...ACTIVE, literal_resolution: 'full' as const },
      { ...equalsFilter, comparator: '2024-01-01 10:08:11' },
    ),
  ).toBe(true);
});

test('a transform the database rejects shows nothing', () => {
  // `active` is a parse, and `no_such_fn(:value)` parses happily, so it was
  // active while the probe failed at query time and the mirror was dropped.
  // Promising a speed-up that never happens is the thing this glyph must not
  // do.
  const REFUSED = { ...ACTIVE, evaluable: false };

  const { container } = render(<PartitionPruningIndicator mapping={REFUSED} />);

  expect(container).toBeEmptyDOMElement();
  expect(isMirroredColumn(REFUSED, 'event_time')).toBe(false);
  expect(isMirroredFilter(REFUSED, equalsFilter)).toBe(false);
});

test('a mapping nothing has probed yet keeps the glyph', () => {
  // A cold cache is not a failure. Going quiet until some chart happens to run
  // would trade one wrong claim for another.
  const UNPROBED = { ...ACTIVE, evaluable: null };

  render(<PartitionPruningIndicator mapping={UNPROBED} />);

  expect(screen.getByTestId('partition-pruning-indicator')).toBeInTheDocument();
  expect(isMirroredFilter(UNPROBED, equalsFilter)).toBe(true);
});
