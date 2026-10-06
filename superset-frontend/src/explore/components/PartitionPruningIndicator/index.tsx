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
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { NO_TIME_RANGE } from '@superset-ui/core';
import { Button, Icons, Tooltip } from '@superset-ui/core/components';
import type { PartitionFilterMapping } from '@superset-ui/chart-controls';
import { ExpressionTypes } from 'src/explore/components/controls/FilterControl/types';
import { NULL_STRING } from 'src/utils/common';

interface PartitionPruningIndicatorProps {
  /** The dataset's mapping summary, straight off the datasource payload. */
  mapping?: PartitionFilterMapping | null;
}

/**
 * The parts of an ad-hoc filter that decide whether it is mirrored. Structural
 * rather than the `AdhocFilter` class so native filters and cross-filters --
 * which reach the query path in the same shape but are not that class -- can be
 * checked with the same function.
 */
export interface MirrorCandidateFilter {
  expressionType?: string;
  subject?: string | { column_name?: string } | null;
  operator?: string | null;
  comparator?: unknown;
  /**
   * The time grain a drill-to-detail filter carries. Present here because it
   * decides whether the filter mirrors at all -- see `isMirroredFilter`.
   */
  grain?: string | null;
}

/**
 * Whether this mapping mirrors anything at all.
 *
 * `active` is the save path's verdict -- a parse, which a misspelled function
 * clears happily -- so on its own it promised a speed-up for a transform the
 * database rejects: the probe fails at query time, the mirror is dropped, and
 * nothing said so. `evaluable` is the weaker claim the engine answers, and
 * `null` means nothing has probed yet, which is not a reason to go quiet.
 */
function mirrorsAnything(
  mapping: PartitionFilterMapping | null | undefined,
): mapping is PartitionFilterMapping {
  // A type predicate rather than a `boolean`: an absent mapping mirrors
  // nothing, so `true` here means there is one, and the callers that go on to
  // read its fields should not each have to re-establish that.
  return Boolean(mapping?.active) && mapping?.evaluable !== false;
}

/**
 * The glyph on a filter whose column is mirrored onto a partition column
 * (wireframe 1d).
 *
 * Chart authors do not configure any of this and ideally never learn the word
 * "partition"; the indicator exists only to explain why their query got faster,
 * and to point at the generated SQL where the extra predicate is visible.
 */
export default function PartitionPruningIndicator({
  mapping,
}: PartitionPruningIndicatorProps) {
  const theme = useTheme();

  if (!mirrorsAnything(mapping)) {
    return null;
  }

  const explanation = t(
    'This filter is also applied to a partition column for faster queries. See "View query" for the generated SQL.',
  );

  return (
    <Tooltip placement="top" title={explanation}>
      {/* A text-variant `Button` rather than a `span`, the same shape
          `InfoTooltip` uses: the glyph's only explanation is this tooltip, and
          on a non-focusable element with no accessible name a keyboard or
          screen-reader user has no way to reach it. */}
      <Button
        type="text"
        variant="text"
        data-test="partition-pruning-indicator"
        aria-label={explanation}
        css={css`
          box-shadow: none;
          padding: 0;
          height: auto;
          background: none;
          vertical-align: middle;
          &&&:hover,
          &&&:focus,
          &&&:active {
            box-shadow: none;
            background: none;
          }
        `}
        icon={
          <Icons.FilterOutlined
            iconSize="s"
            iconColor={theme.colorSuccess}
            css={css`
              margin-left: ${theme.sizeUnit}px;
            `}
          />
        }
      />
    </Tooltip>
  );
}

/**
 * The filter's column name. `subject` is a bare string for simple filters and a
 * column object when the filter was built from a dropped column.
 */
function subjectName(
  subject: MirrorCandidateFilter['subject'],
): string | undefined {
  return typeof subject === 'string'
    ? subject
    : (subject?.column_name ?? undefined);
}

/**
 * Whether `columnName` is the one column the mapping mirrors.
 *
 * Necessary but not sufficient for the glyph -- see `isMirroredFilter`.
 */
export function isMirroredColumn(
  mapping: PartitionFilterMapping | null | undefined,
  columnName: string | null | undefined,
): boolean {
  return Boolean(
    mirrorsAnything(mapping) &&
    columnName &&
    mapping.mapped_column === columnName,
  );
}

/** Whether a comparator reaches the query path as a real `NULL`. */
function isNullish(value: unknown): boolean {
  // `<NULL>` is the sentinel Explore puts in a filter value for a real NULL;
  // `filter_values_handler` converts it back to `None` server-side, so it is
  // nullish here for exactly the same reason `null` is.
  return value == null || value === NULL_STRING;
}

const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;
const MIDNIGHT = /^00:00(?::00(?:\.0+)?)?$/;

/**
 * A value written as an ISO date *and* a non-zero time of day.
 *
 * Deliberately narrower than the backend's `datetime.fromisoformat`, and
 * deliberately only ever used to *hide* the glyph. `Date.parse` accepts strings
 * `fromisoformat` rejects and the reverse, so matching the server's acceptance
 * set here is not achievable; what is achievable is a pattern that only ever
 * fires on a value the server certainly declines. Anything else falls back to
 * showing the glyph, which is the advisory behaviour this control has always
 * had -- see `isMirroredFilter`.
 */
function carriesTimeOfDay(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const time = ISO_DATETIME.exec(value)?.[1];
  // Midnight is not a time of day for this purpose: the engine's comparison and
  // the mirror's value agree there, so the filter does mirror.
  return time !== undefined && !MIDNIGHT.test(time);
}

/**
 * Whether the comparator is one the mirrored predicate can be built from.
 *
 * A `NULL` inside an `IN` list widens the real predicate to
 * `col IS NULL OR col IN (...)`, which the mirror cannot express, so the
 * backend skips those lists outright.
 *
 * An empty string is *not* excluded. The backend's mirror collector skips only
 * `None`, so `col = ''` -- which Explore writes as the `<empty string>`
 * sentinel -- does mirror, and hiding the glyph for it contradicted the SQL.
 *
 * On a mapped column the engine compares at day resolution, an `=` or `IN`
 * whose value carries a time of day is declined server-side: the filter keeps
 * the whole day while a mirror derived from the time keeps one instant of it,
 * and an AND-ed equality has nowhere to widen to. Only those two operators --
 * a bound does have somewhere to widen to, and widens to the day rather than
 * declining, so the glyph stays on it.
 */
function hasMirrorableValue(
  operator: string,
  comparator: unknown,
  resolution: PartitionFilterMapping['literal_resolution'],
): boolean {
  if (operator === 'TEMPORAL_RANGE') {
    // `No filter` resolves to neither bound, so no range is mirrored.
    return typeof comparator === 'string' && comparator !== NO_TIME_RANGE;
  }
  if (operator === 'IN') {
    return (
      Array.isArray(comparator) &&
      comparator.length > 0 &&
      !comparator.some(isNullish) &&
      !(resolution === 'day' && comparator.some(carriesTimeOfDay))
    );
  }
  if (
    operator === '==' &&
    resolution === 'day' &&
    carriesTimeOfDay(comparator)
  ) {
    return false;
  }
  return !isNullish(comparator);
}

/**
 * Whether this filter actually produces a predicate on the partition column.
 *
 * Naming the mapped column is only the first of the query path's gates
 * (`_collect_partition_mirror_filter` in `superset/models/helpers.py`): the
 * operator has to be one the mapping can mirror, and the value has to be one
 * the mirrored predicate can carry. A `country != 'US'` chip names the mapped
 * column and mirrors nothing -- negations are never safe, because the transform
 * need not be injective -- so labelling it would promise a speed-up the query
 * does not deliver.
 *
 * The operator list is not restated here; it is computed server-side from the
 * transform's declared monotonicity and shipped on the mapping.
 *
 * One gate is deliberately not reproduced. A virtual dataset's SQL can consume
 * a filter with a Jinja `get_filters('col', remove_filter=True)` call, and
 * `should_skip_filter` then drops both the filter's own predicate and its
 * mirror -- so the glyph can appear on a filter that produces no SQL at all.
 * `removed_filters` is assembled while the query is generated and is not in
 * `form_data`, so the only way to know would be to render the template in the
 * browser. The glyph is advisory, and "View query" remains the authority.
 */
export function isMirroredFilter(
  mapping: PartitionFilterMapping | null | undefined,
  filter: MirrorCandidateFilter | null | undefined,
): boolean {
  if (!mirrorsAnything(mapping) || !filter) {
    return false;
  }
  // Free-form SQL filters are appended verbatim as `extras.where`; the backend
  // never sees an (operator, value) pair to mirror.
  if (
    filter.expressionType &&
    filter.expressionType !== ExpressionTypes.Simple
  ) {
    return false;
  }
  if (!isMirroredColumn(mapping, subjectName(filter.subject))) {
    return false;
  }
  if (
    !filter.operator ||
    !mapping.mirrorable_operators?.includes(filter.operator)
  ) {
    return false;
  }
  // A grain makes the real predicate compare the *truncated* column, so the raw
  // value no longer describes the rows it matches: drill-to-detail sends `==` on
  // a bucket start, which every row in the bucket satisfies once truncated.
  // `_collect_partition_mirror_filter` is skipped entirely for those, so the
  // glyph would promise pruning the query does not do. A grained range is the
  // exception -- it mirrors by widening both bounds.
  if (filter.grain && filter.operator !== 'TEMPORAL_RANGE') {
    return false;
  }
  return hasMirrorableValue(
    filter.operator,
    filter.comparator,
    mapping.literal_resolution,
  );
}
