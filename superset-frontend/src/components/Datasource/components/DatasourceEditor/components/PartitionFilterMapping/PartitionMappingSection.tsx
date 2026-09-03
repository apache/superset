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
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Checkbox,
  Flex,
  Icons,
  InfoTooltip,
  Input,
  Loading,
  Typography,
} from '@superset-ui/core/components';
import { usePartitionMappingPreview } from './usePartitionMappingPreview';
import {
  partitionRowState,
  previewOperatorFor,
  sampleValuesFor,
} from './utils';
import type { PartitionMappingColumn, PartitionMappingDatasource } from './types';

interface PartitionMappingSectionProps {
  /** Injected by Field when `passItemToControl` is set. */
  item?: PartitionMappingColumn;
  /** The column's `partition_value_transform`, injected by Field. */
  value?: string | null;
  onChange?: (newValue: string | null) => void;
  datasource: PartitionMappingDatasource;
  /** Move the mapping onto this column, pre-filling a transform if we have one. */
  onMoveMappingHere: (columnName: string) => void;
  onRemoveMapping: () => void;
  onMonotonicChange: (columnName: string, isMonotonic: boolean) => void;
}

/**
 * The "Partition filter mapping" subsection of a column's row expand
 * (wireframes 1c, 1h).
 *
 * Three states, because the model is one partition column and one mapped
 * column: the mapped column carries the transform, every other column offers to
 * take the mapping over, and the partition column itself shows nothing -- it is
 * the target, not a source.
 */
export default function PartitionMappingSection({
  item,
  value,
  onChange,
  datasource,
  onMoveMappingHere,
  onRemoveMapping,
  onMonotonicChange,
}: PartitionMappingSectionProps) {
  const theme = useTheme();
  const columnName = item?.column_name ?? '';
  const state = partitionRowState(datasource, columnName);
  const isMonotonic = Boolean(item?.partition_transform_is_monotonic);
  const transform = value ?? '';
  const isTemporal = Boolean(item?.is_dttm);

  const { preview, loading } = usePartitionMappingPreview({
    datasetId: datasource.id,
    mappedColumn: columnName,
    partitionColumn: datasource.partition_column ?? '',
    valueTransform: transform,
    sampleValues: sampleValuesFor(item),
    operator: previewOperatorFor(item),
    isMonotonic,
    enabled: state === 'mapped',
  });

  if (state === 'none' || state === 'partition') {
    return null;
  }

  if (state === 'unmapped') {
    return (
      <Alert
        type="info"
        showIcon
        icon={<Icons.FilterOutlined />}
        data-test="partition-mapping-unmapped"
        message={
          <span>
            {t('Not currently mapped to the partition column.')}{' '}
            <Typography.Link
              onClick={() => onMoveMappingHere(columnName)}
              data-test="move-mapping-here"
            >
              {t('Move mapping to this column →')}
            </Typography.Link>
          </span>
        }
      />
    );
  }

  return (
    <Flex
      vertical
      gap={theme.sizeUnit * 2}
      data-test="partition-mapping-section"
      css={css`
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.borderRadius}px;
        padding: ${theme.sizeUnit * 3}px;
        /* The expanded row sizes to its content, so without this the longest
           line of helper text sets the table's width and everything to the
           right of it -- including the preview's validity chip -- is pushed
           out of view. */
        max-width: 100%;
        min-width: 0;
        overflow-wrap: anywhere;
      `}
    >
      <Flex align="center" gap={theme.sizeUnit}>
        <Icons.FilterOutlined />
        <Typography.Text strong>{t('Partition filter mapping')}</Typography.Text>
      </Flex>
      <Typography.Text type="secondary">
        {isTemporal
          ? t('Filters on this column are mirrored onto the partition field.')
          : t(
              'This column holds the mapping instead of the default datetime column.',
            )}
      </Typography.Text>

      <Flex align="center" gap={theme.sizeUnit}>
        <Typography.Text>{t('Partition field:')}</Typography.Text>
        <Typography.Text code>{datasource.partition_column}</Typography.Text>
        <Typography.Text type="secondary">
          {t('— set in Default Column Settings · one per dataset')}
        </Typography.Text>
      </Flex>

      <Flex vertical gap={theme.sizeUnit}>
        <Flex align="center" gap={theme.sizeUnit}>
          <Typography.Text>{t('Value transform')}</Typography.Text>
          {!isTemporal && (
            <Typography.Text type="danger" aria-label={t('Required')}>
              *
            </Typography.Text>
          )}
          <InfoTooltip
            tooltip={t(
              'A SQL expression evaluated against the engine, with :value standing for the filter bound being mirrored.',
            )}
          />
        </Flex>
        <Input
          value={transform}
          onChange={event => onChange?.(event.target.value || null)}
          placeholder="unix_timestamp(:value)"
          aria-label={t('Value transform')}
          data-test="partition-value-transform"
          css={css`
            font-family: ${theme.fontFamilyCode};
          `}
        />
        <Typography.Text type="secondary">
          {isTemporal
            ? t('Use :value for the filter bound.')
            : t('Required for non-temporal columns. Use :value for each value.')}
        </Typography.Text>
      </Flex>

      <Flex align="center" gap={theme.sizeUnit}>
        <Checkbox
          checked={isMonotonic}
          onChange={event => onMonotonicChange(columnName, event.target.checked)}
          data-test="partition-transform-is-monotonic"
        >
          {t('Transform preserves ordering')}
        </Checkbox>
        <InfoTooltip
          tooltip={t(
            'Monotonicity is a property of the transform, not of the column type: hour(:value) and dayofweek(:value) are reasonable transforms on a timestamp and neither preserves ordering, so Superset asks rather than guessing. Unchecked, = and IN still mirror.',
          )}
        />
      </Flex>
      <Typography.Text type="secondary">
        {t('Required to mirror range filters, including the time range.')}
      </Typography.Text>

      {loading && <Loading position="inline-centered" />}

      {!loading && preview?.valid && (
        <Flex
          vertical
          gap={theme.sizeUnit}
          data-test="partition-mapping-preview"
          css={css`
            background-color: ${theme.colorBgLayout};
            border-radius: ${theme.borderRadius}px;
            padding: ${theme.sizeUnit * 2}px;
            max-width: 100%;
            min-width: 0;
          `}
        >
          <Flex justify="space-between" align="center">
            <Typography.Text type="secondary">{t('PREVIEW')}</Typography.Text>
            <Flex align="center" gap={theme.sizeUnit}>
              <Icons.CheckOutlined iconColor={theme.colorSuccess} iconSize="s" />
              <Typography.Text type="success">{t('Valid')}</Typography.Text>
            </Flex>
          </Flex>
          <Flex gap={theme.sizeUnit * 2}>
            <Typography.Text type="secondary">
              {t('Sample input')}
            </Typography.Text>
            <Typography.Text code>{preview.sample_input}</Typography.Text>
          </Flex>
          <Flex gap={theme.sizeUnit * 2}>
            <Typography.Text type="secondary">
              {t('Emitted predicate')}
            </Typography.Text>
            <Typography.Text code>{preview.emitted_predicate}</Typography.Text>
          </Flex>
        </Flex>
      )}

      {/* Only one of preview and error is ever visible. */}
      {!loading && preview && !preview.valid && (
        <Alert
          // A range that won't mirror is a live warning about the checkbox
          // above, not a broken transform; calling it an error would be wrong.
          type={preview.reason === 'operator' ? 'warning' : 'error'}
          showIcon
          data-test="partition-mapping-error"
          message={
            preview.reason === 'parse'
              ? t("Can't parse transform")
              : t('Filters will not be mirrored')
          }
          description={preview.error}
        />
      )}

      <Flex justify="flex-end">
        <Button
          buttonStyle="link"
          onClick={onRemoveMapping}
          icon={<Icons.DeleteOutlined iconColor={theme.colorError} />}
          data-test="remove-partition-mapping"
        >
          <Typography.Text type="danger">{t('Remove mapping')}</Typography.Text>
        </Button>
      </Flex>
    </Flex>
  );
}
