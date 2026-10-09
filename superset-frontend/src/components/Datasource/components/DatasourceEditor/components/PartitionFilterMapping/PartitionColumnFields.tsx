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
import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Flex,
  Icons,
  InfoTooltip,
  Label,
  Select,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import {
  mappedColumnIsImplicit,
  mappingIsActive,
  partitionMappingErrors,
  resolveMappedColumn,
  suggestedMappedColumn,
} from './utils';
import type {
  PartitionMappingColumn,
  PartitionMappingDatasource,
  PartitionMappingIssue,
} from './types';

interface PartitionColumnFieldsProps {
  datasource: PartitionMappingDatasource;
  /**
   * Physical columns: what the partition-column dropdown may offer, and where
   * a replacement mapped column may be suggested from. A calculated column
   * belongs in neither -- the engine cannot partition on an expression, and
   * the mapping picker only renders on a physical column's row.
   */
  columns: PartitionMappingColumn[];
  /**
   * Every column on the dataset, physical and calculated. What *exists* is a
   * different question from what may be picked, and validation asks the first:
   * the backend accepts a calculated column as the mapped-column override, so
   * checking existence against the physical columns alone reported a column
   * that is really there as missing -- and blocked Save with no way out, since
   * the dropdown cannot offer it back.
   */
  allColumns: PartitionMappingColumn[];
  onPartitionColumnChange: (columnName: string | null) => void;
  /** Open the given column's row expand in the Columns table. */
  onNavigateToColumn: (columnName: string) => void;
  /**
   * Whether the mapped column's own preview says the transform mirrors, or
   * `null`/undefined when no verdict is in yet. The checks this section can
   * make are all static -- a transform the database rejects clears every one
   * of them -- so without the preview's answer the banner claimed a speed-up
   * the query never delivers.
   */
  previewMirrors?: boolean | null;
}

/**
 * "Partition column" and the computed "Maps to partition" (wireframes 1a, 1g).
 *
 * "Maps to partition" is deliberately read-only. It reflects
 * `partition_mapped_column ?? main_dttm_col`, and a peer dropdown would let it
 * drift from the default datetime column silently. The only way to override it
 * is from the target column's own row, where a transform has to be supplied
 * alongside.
 */
export default function PartitionColumnFields({
  datasource,
  columns,
  allColumns,
  onPartitionColumnChange,
  onNavigateToColumn,
  previewMirrors,
}: PartitionColumnFieldsProps) {
  const theme = useTheme();

  const options = useMemo(
    () =>
      columns.map(column => ({
        value: column.column_name,
        label: column.column_name,
        customLabel: (
          <Flex align="center" gap={theme.sizeUnit}>
            <span>{column.column_name}</span>
            {column.type && <Label>{column.type}</Label>}
          </Flex>
        ),
      })),
    [columns, theme.sizeUnit],
  );

  const mappedColumn = resolveMappedColumn(datasource);
  const isImplicit = mappedColumnIsImplicit(datasource);
  const liveTransform =
    allColumns.find(column => column.column_name === mappedColumn)
      ?.partition_value_transform ?? null;
  // The stored refusal, but only while the box still holds the expression it
  // was about. It is a verdict on one transform, and it outlived it: reopen a
  // dataset whose stored `no_such_fn(:value)` failed its last probe, replace it
  // with something that works, watch the row's own preview come back valid --
  // and the banner still said nothing would mirror, because this read a summary
  // computed when the editor opened.
  const storedVerdictApplies =
    liveTransform === datasource.partition_filter_mapping?.evaluated_transform;
  // The static checks are necessary, not sufficient: an unparseable expression
  // or a function the database does not have needs the engine to spot, and the
  // mapped column's row already asks it. Deferring to that answer where there
  // is one is what keeps this banner and that panel from contradicting each
  // other.
  const isActive =
    mappingIsActive(datasource, allColumns) &&
    previewMirrors !== false &&
    !(
      storedVerdictApplies &&
      datasource.partition_filter_mapping?.evaluable === false
    );
  const { partition_column: partitionColumn } = datasource;

  // `field` is what the issues carry it for: a message about the partition
  // column belongs under the partition column, not only in the Save button's
  // tooltip, where an owner has to guess which of the two selects is at fault.
  const issues = useMemo(
    () => partitionMappingErrors(datasource, allColumns),
    [datasource, allColumns],
  );
  const issueFor = (field: PartitionMappingIssue['field']) =>
    issues.find(issue => issue.field === field)?.message;

  // "Map a different column instead" normally opens the currently-mapped
  // column's row, which is where the picker lives. When the mapped column *is*
  // the partition column -- the self-mapping the backend rejects, and reachable
  // in one click because the picker offers every column -- that row renders no
  // mapping section at all, so the one guided way out of the broken state led
  // nowhere. Offer a column that is not the partition column instead.
  //
  // Null only when there is no mapped column at all, which is also when the
  // block below does not render -- but a dataset whose every column is the
  // partition column would otherwise be offered a link to nothing, so the link
  // is guarded rather than the type asserted away.
  const differentColumnTarget =
    mappedColumn && mappedColumn !== partitionColumn
      ? mappedColumn
      : (suggestedMappedColumn(columns, partitionColumn) ?? mappedColumn);

  return (
    <Flex vertical gap={theme.sizeUnit} data-test="partition-column-fields">
      <Flex align="center" gap={theme.sizeUnit}>
        <Typography.Text>{t('Partition column')}</Typography.Text>
        <InfoTooltip
          tooltip={t(
            'The physical column the engine partitions on. Filters on the mapped column are mirrored onto it so the engine can prune partitions.',
          )}
        />
      </Flex>
      <Select
        ariaLabel={t('Partition column')}
        options={options}
        value={partitionColumn ?? undefined}
        onChange={value => onPartitionColumnChange((value as string) ?? null)}
        onClear={() => onPartitionColumnChange(null)}
        placeholder={t('None')}
        allowClear
        data-test="partition-column-select"
      />
      {issueFor('partition_column') && (
        <Typography.Text type="danger" data-test="partition-column-error">
          {issueFor('partition_column')}
        </Typography.Text>
      )}
      <Typography.Text type="secondary">
        {t(
          'Column used for partition pruning on this table. Its Is filterable and Is dimension settings decide whether Explore offers it.',
        )}
      </Typography.Text>

      {partitionColumn && (
        <Flex vertical gap={theme.sizeUnit} data-test="maps-to-partition">
          <Flex align="center" gap={theme.sizeUnit}>
            <Typography.Text type="secondary">
              {t('Maps to partition')}
            </Typography.Text>
            <InfoTooltip
              tooltip={t(
                'The column whose filters are mirrored. It follows the default datetime column unless a different column holds the mapping.',
              )}
            />
          </Flex>

          {mappedColumn ? (
            <>
              <Flex align="center" gap={theme.sizeUnit}>
                <Label>{mappedColumn}</Label>
                {isImplicit && (
                  <>
                    <Typography.Text type="secondary">
                      {t('Default datetime column')}
                    </Typography.Text>
                    <Tooltip
                      title={t(
                        'Set from the default datetime column above, so re-pointing that column moves the mapping with it.',
                      )}
                    >
                      <Icons.LockOutlined
                        iconSize="s"
                        iconColor={theme.colorTextTertiary}
                      />
                    </Tooltip>
                  </>
                )}
              </Flex>
              {issueFor('partition_mapped_column') && (
                <Typography.Text
                  type="danger"
                  data-test="partition-mapped-column-error"
                >
                  {issueFor('partition_mapped_column')}
                </Typography.Text>
              )}
              <Typography.Text type="secondary">
                {t(
                  'Filters on this column are mirrored onto the partition column.',
                )}
                {differentColumnTarget && (
                  <>
                    {' '}
                    <Button
                      buttonStyle="link"
                      onClick={() => onNavigateToColumn(differentColumnTarget)}
                      data-test="map-a-different-column"
                    >
                      {t('Map a different column instead →')}
                    </Button>
                  </>
                )}
              </Typography.Text>
              {isActive ? (
                <Alert
                  type="info"
                  showIcon
                  icon={<Icons.FilterOutlined />}
                  message={
                    <span>
                      {t(
                        'Filters on %(mapped)s will automatically apply an equivalent filter to %(partition)s.',
                        { mapped: mappedColumn, partition: partitionColumn },
                      )}{' '}
                      <Button
                        buttonStyle="link"
                        onClick={() => onNavigateToColumn(mappedColumn)}
                      >
                        {t('Customize the value transform →')}
                      </Button>
                    </span>
                  }
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message={
                    liveTransform
                      ? t(
                          'The value transform on %(mapped)s is not mirroring filters, so queries will scan every partition.',
                          { mapped: mappedColumn },
                        )
                      : t(
                          'No value transform is set on %(mapped)s, so nothing is mirrored yet and queries will scan every partition.',
                          { mapped: mappedColumn },
                        )
                  }
                />
              )}
            </>
          ) : (
            <>
              <Flex align="center" gap={theme.sizeUnit}>
                <Label
                  css={css`
                    color: ${theme.colorTextTertiary};
                  `}
                >
                  {t('No mapping')}
                </Label>
                <Button
                  buttonStyle="link"
                  onClick={() => {
                    const candidate = suggestedMappedColumn(
                      columns,
                      partitionColumn,
                    );
                    if (candidate) {
                      onNavigateToColumn(candidate);
                    }
                  }}
                  data-test="map-a-column"
                >
                  {t('Map a column →')}
                </Button>
              </Flex>
              <Typography.Text type="secondary">
                {t(
                  'Normally the default datetime column, but none is set on this dataset.',
                )}
              </Typography.Text>
              <Alert
                type="warning"
                showIcon
                message={t(
                  'No filter is mirrored onto %(partition)s — queries will scan every partition until a column is mapped.',
                  { partition: partitionColumn },
                )}
              />
            </>
          )}
        </Flex>
      )}
    </Flex>
  );
}
