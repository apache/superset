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
import { Icons, Tooltip } from '@superset-ui/core/components';
import type { PartitionFilterMapping } from '@superset-ui/chart-controls';

interface PartitionPruningIndicatorProps {
  /** The dataset's mapping summary, straight off the datasource payload. */
  mapping?: PartitionFilterMapping | null;
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
 * Whether a filter on `columnName` is the one being mirrored.
 *
 * The mapping names exactly one mapped column, so anything else on the chart --
 * including other filters on the same dataset -- gets no indicator.
 */
export function isMirroredColumn(
  mapping: PartitionFilterMapping | null | undefined,
  columnName: string | null | undefined,
): boolean {
  return Boolean(
    mapping?.active && columnName && mapping.mapped_column === columnName,
  );
}
