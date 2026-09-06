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
import { Icons, Tooltip } from '@superset-ui/core/components';
import type { PartitionFilterMapping } from '@superset-ui/chart-controls';
import { ExpressionTypes } from 'src/explore/components/controls/FilterControl/types';

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

  if (!mapping?.active) {
    return null;
  }

  return (
    <Tooltip
      placement="top"
      title={t(
        'This filter is also applied to a partition column for faster queries. See "View query" for the generated SQL.',
      )}
    >
      <span data-test="partition-pruning-indicator">
        <Icons.FilterOutlined
          iconSize="s"
          iconColor={theme.colorSuccess}
          css={css`
            margin-left: ${theme.sizeUnit}px;
            vertical-align: middle;
          `}
        />
      </span>
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
    mapping?.active && columnName && mapping.mapped_column === columnName,
  );
}

/**
 * Whether the comparator is one the mirrored predicate can be built from.
 *
 * A `NULL` inside an `IN` list widens the real predicate to
 * `col IS NULL OR col IN (...)`, which the mirror cannot express, so the
 * backend skips those lists outright.
 */
function hasMirrorableValue(operator: string, comparator: unknown): boolean {
  if (operator === 'TEMPORAL_RANGE') {
    // `No filter` resolves to neither bound, so no range is mirrored.
    return typeof comparator === 'string' && comparator !== NO_TIME_RANGE;
  }
  if (operator === 'IN') {
    return (
      Array.isArray(comparator) &&
      comparator.length > 0 &&
      !comparator.some(value => value == null)
    );
  }
  return comparator !== null && comparator !== undefined && comparator !== '';
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
 */
export function isMirroredFilter(
  mapping: PartitionFilterMapping | null | undefined,
  filter: MirrorCandidateFilter | null | undefined,
): boolean {
  if (!mapping?.active || !filter) {
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
  return hasMirrorableValue(filter.operator, filter.comparator);
}
