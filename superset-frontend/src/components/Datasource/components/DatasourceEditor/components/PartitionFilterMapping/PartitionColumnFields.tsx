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
  resolveMappedColumn,
} from './utils';
import type { PartitionMappingColumn, PartitionMappingDatasource } from './types';

interface PartitionColumnFieldsProps {
  datasource: PartitionMappingDatasource;
  columns: PartitionMappingColumn[];
  onPartitionColumnChange: (columnName: string | null) => void;
  /** Open the given column's row expand in the Columns table. */
  onNavigateToColumn: (columnName: string) => void;
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
  onPartitionColumnChange,
  onNavigateToColumn,
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
  const isActive = mappingIsActive(datasource, columns);
  const { partition_column: partitionColumn } = datasource;

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
      <Typography.Text type="secondary">
        {t(
          "Column used for partition pruning on this table. Selecting one hides it from Explore's dimension and filter pickers by default.",
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
              <Typography.Text type="secondary">
                {t(
                  'Filters on this column are mirrored onto the partition column.',
                )}{' '}
                <Typography.Link
                  onClick={() => onNavigateToColumn(mappedColumn)}
                  data-test="map-a-different-column"
                >
                  {t('Map a different column instead →')}
                </Typography.Link>
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
                      <Typography.Link
                        onClick={() => onNavigateToColumn(mappedColumn)}
                      >
                        {t('Customize the value transform →')}
                      </Typography.Link>
                    </span>
                  }
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message={t(
                    'No value transform is set on %(mapped)s, so nothing is mirrored yet and queries will scan every partition.',
                    { mapped: mappedColumn },
                  )}
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
                <Typography.Link
                  onClick={() => {
                    const firstOther = columns.find(
                      column => column.column_name !== partitionColumn,
                    );
                    if (firstOther) {
                      onNavigateToColumn(firstOther.column_name);
                    }
                  }}
                  data-test="map-a-column"
                >
                  {t('Map a column →')}
                </Typography.Link>
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
                  '%(partition)s is hidden from Explore, but no filter is mirrored onto it — queries will scan every partition until a column is mapped.',
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
