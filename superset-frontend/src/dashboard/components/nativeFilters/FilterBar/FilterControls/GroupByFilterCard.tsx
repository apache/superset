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
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  useTruncation,
  ChartCustomization,
  NativeFilterTarget,
} from '@superset-ui/core';
import {
  styled,
  css,
  useTheme,
  SupersetTheme,
} from '@apache-superset/core/theme';
import {
  Typography,
  Select,
  type LabeledValue,
  Popover,
  Loading,
  Icons,
  Tooltip,
  FormItem,
} from '@superset-ui/core/components';
import { propertyComparator } from '@superset-ui/core/components/Select/utils';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import { setPendingChartCustomization } from 'src/dashboard/stores';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useDatasetMetadata } from 'src/dashboard/queries';
import { dispatchChartCustomizationHoverAction } from './utils';
import {
  datasetLabel as getDatasetLabel,
  datasetLabelLower,
} from 'src/features/semanticLayers/label';

interface ColumnApiResponse {
  column_name?: string;
  name?: string;
  verbose_name?: string;
  filterable?: boolean;
}

interface GroupByFilterCardProps {
  customizationItem: ChartCustomization;
  orientation?: 'vertical' | 'horizontal';
  dataMaskSelected?: DataMaskStateWithId;
  onFilterSelectionChange?: (
    filter: Filter | ChartCustomization,
    dataMask: DataMask,
  ) => void;
}

const Row = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.sizeUnit}px 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:first-of-type {
    margin-top: 0;
  }

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const RowLabel = styled.span`
  color: ${({ theme }) => theme.colorTextSecondary};
  padding-right: ${({ theme }) => theme.sizeUnit * 4}px;
  margin-right: auto;
  white-space: nowrap;
`;

const RowValue = styled.div`
  color: ${({ theme }) => theme.colorText};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline;
`;

const InternalRow = styled.div`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const FilterTitle = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
  font-weight: 600;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HorizontalFormItem = styled(FormItem)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    display: flex;
    align-items: center;
    overflow: visible;
    padding-bottom: 0;
    margin-right: ${({ theme }) => theme.sizeUnit * 2}px;

    & > label {
      margin-bottom: 0;
      padding: 0;
      line-height: 1;
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      font-weight: ${({ theme }) => theme.fontWeightNormal};
      color: ${({ theme }) => theme.colorText};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &::after {
        display: none;
      }
    }
  }

  .ant-form-item-control {
    min-width: 164px;
    max-width: none;
  }

  .select-container {
    width: 100%;
  }

  .ant-select-dropdown {
    min-width: 200px !important;
    max-width: 400px !important;
  }
`;

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSize}px;
  display: flex;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const RequiredFieldIndicator = () => (
  <span
    css={(theme: SupersetTheme) => ({
      color: theme.colorError,
      fontSize: `${theme.fontSizeSM}px`,
      paddingLeft: '1px',
    })}
  >
    *
  </span>
);

const DescriptionTooltip = ({ description }: { description: string }) => (
  <ToolTipContainer>
    <Tooltip
      title={description}
      placement="right"
      overlayInnerStyle={{
        display: '-webkit-box',
        WebkitLineClamp: 10,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
      }}
    >
      <Icons.InfoCircleOutlined
        className="text-muted"
        role="button"
        css={theme => ({
          paddingLeft: `${theme.sizeUnit}px`,
        })}
      />
    </Tooltip>
  </ToolTipContainer>
);

// Sort display values by label: ascending when sortAscending is true, descending
// when false, and source order (no sort) when it is unset.
export const createLabelSortComparator =
  (sortAscending?: boolean) =>
  (a: LabeledValue, b: LabeledValue): number => {
    if (sortAscending === undefined) {
      return 0;
    }
    const labelComparator = propertyComparator('label');
    return sortAscending ? labelComparator(a, b) : labelComparator(b, a);
  };

/**
 * Maps a dataset's columns to group-by Select options: drops non-filterable
 * columns and prefers the verbose name. Extracted for unit testing.
 */
export const mapDatasetColumnsToOptions = (
  columns: ColumnApiResponse[] | undefined,
): { label: string; value: string }[] =>
  (columns ?? [])
    .filter(col => col.filterable !== false)
    .map(col => ({
      label: col.verbose_name || col.column_name || col.name || '',
      value: col.column_name || col.name || '',
    }));

const GroupByFilterCardContent: FC<{
  customizationItem: ChartCustomization;
  hidePopover: () => void;
  datasetName?: string;
}> = ({ customizationItem, datasetName }) => {
  const { name } = customizationItem;
  const dataset = customizationItem.targets?.[0]?.datasetId;
  const [titleRef, , titleTruncated] = useTruncation();
  const displayName = name?.trim() || t('Dynamic group by');

  const datasetLabel = useMemo(() => {
    if (!dataset) {
      return t('Not set');
    }
    if (datasetName) {
      return datasetName;
    }
    return t('None');
  }, [dataset, datasetName]);

  return (
    <div>
      <Row
        css={theme => css`
          margin-bottom: ${theme.sizeUnit * 3}px;
          justify-content: flex-start;
        `}
      >
        <InternalRow>
          <Icons.GroupOutlined
            iconSize="s"
            css={theme => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          />
          <TooltipWithTruncation title={titleTruncated ? displayName : null}>
            <div ref={titleRef}>
              <Typography.Text strong>{displayName}</Typography.Text>
            </div>
          </TooltipWithTruncation>
        </InternalRow>
      </Row>
      <Row>
        <RowLabel>{t('Type')}</RowLabel>
        <RowValue>{t('Dynamic group by')}</RowValue>
      </Row>

      <Row>
        <RowLabel>{getDatasetLabel()}</RowLabel>
        <RowValue>
          {typeof datasetLabel === 'string' ? datasetLabel : t('Dataset')}
        </RowValue>
      </Row>
    </div>
  );
};

const GroupByFilterCard: FC<GroupByFilterCardProps> = ({
  customizationItem,
  orientation = 'vertical',
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const theme = useTheme();
  const dataset = customizationItem.targets?.[0]?.datasetId;
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();

  const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);

  const datasetId =
    typeof dataset === 'number' || typeof dataset === 'string'
      ? dataset
      : typeof dataset === 'object' && dataset !== null && 'value' in dataset
        ? (dataset as { value: string | number }).value
        : null;

  const {
    data: datasetData,
    isFetching: loading,
    error: datasetError,
  } = useDatasetMetadata(datasetId);

  const datasetName = datasetData?.table_name as string | undefined;

  const columnOptions = useMemo(
    () =>
      mapDatasetColumnsToOptions(
        datasetData?.columns as ColumnApiResponse[] | undefined,
      ),
    [datasetData],
  );

  const { addDangerToast } = useToasts();

  const isHorizontalLayout = orientation === 'horizontal';

  const hideHoverCard = useCallback(() => {
    setIsHoverCardVisible(false);
  }, []);

  const setHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(customizationItem.id),
    [customizationItem.id],
  );

  const unsetHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(),
    [],
  );

  const isRequired = useMemo(
    () => !!customizationItem.controlValues?.enableEmptyFilter,
    [customizationItem.controlValues?.enableEmptyFilter],
  );

  const dataMask = useDataMaskStore(s => s.dataMask);

  const effectiveDataMask = dataMaskSelected ?? dataMask;

  const columnName = customizationItem.targets?.[0]?.column?.name;

  const currentValue = useMemo(() => {
    const dataMaskValue =
      effectiveDataMask[customizationItem.id]?.filterState?.value;

    if (dataMaskValue !== undefined) {
      return dataMaskValue;
    }

    return null;
  }, [effectiveDataMask, customizationItem.id]);

  const canSelectMultiple =
    customizationItem.controlValues?.canSelectMultiple ?? true;

  const sortAscending = customizationItem.controlValues?.sortAscending;

  const sortComparator = useMemo(
    () => createLabelSortComparator(sortAscending),
    [sortAscending],
  );

  const columnDisplayName = useMemo(() => {
    if (customizationItem.name) {
      return customizationItem.name;
    }
    if (columnName) {
      return columnName;
    }
    return t('Group By');
  }, [customizationItem.name, columnName]);

  const handleColumnChange = useCallback(
    (value: string | string[]) => {
      const columnValue = canSelectMultiple
        ? Array.isArray(value)
          ? value.length > 0
            ? value
            : null
          : value || null
        : typeof value === 'string'
          ? value
          : null;

      const targets: [Partial<NativeFilterTarget>] = columnValue
        ? ([
            {
              datasetId: dataset,
              column: { name: columnValue },
            },
          ] as [Partial<NativeFilterTarget>])
        : ([{}] as [Partial<NativeFilterTarget>]);

      setPendingChartCustomization({
        ...customizationItem,
        targets,
      });

      const groupbyValue = columnValue
        ? Array.isArray(columnValue)
          ? columnValue
          : [columnValue]
        : [];

      const dataMask: DataMask = {
        extraFormData: {
          custom_form_data: {
            groupby: groupbyValue,
          },
        },
        filterState: {
          label: groupbyValue.join(', '),
          value: columnValue,
        },
        ownState: {
          column: columnValue,
        },
      };

      onFilterSelectionChange?.(customizationItem, dataMask);
    },
    [canSelectMultiple, dataset, customizationItem, onFilterSelectionChange],
  );

  useEffect(() => {
    if (!datasetError) {
      return;
    }
    addDangerToast(
      t('Failed to load columns for %s %s', datasetLabelLower(), datasetId),
    );
  }, [datasetError, addDangerToast, datasetId]);

  const displayTitle = columnDisplayName;

  const description = customizationItem.description?.trim();

  return (
    <div>
      {!isHorizontalLayout && (
        <Popover
          placement="right"
          overlayStyle={{ width: '280px' }}
          content={
            <GroupByFilterCardContent
              customizationItem={customizationItem}
              hidePopover={hideHoverCard}
              datasetName={datasetName}
            />
          }
          mouseEnterDelay={0.2}
          mouseLeaveDelay={0.2}
          onOpenChange={visible => {
            setIsHoverCardVisible(visible);
          }}
          open={isHoverCardVisible}
          arrow={false}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              margin-bottom: ${theme.sizeUnit}px;
            `}
          >
            <TooltipWithTruncation
              title={titleElementsTruncated ? displayTitle : null}
            >
              <div ref={filterTitleRef}>
                <FilterTitle>
                  {displayTitle}
                  {isRequired && <RequiredFieldIndicator />}
                </FilterTitle>
              </div>
            </TooltipWithTruncation>
            {description && <DescriptionTooltip description={description} />}
          </div>
        </Popover>
      )}

      {isHorizontalLayout ? (
        <HorizontalFormItem
          label={
            <Popover
              placement="bottom"
              overlayStyle={{ width: '240px' }}
              content={
                <GroupByFilterCardContent
                  customizationItem={customizationItem}
                  hidePopover={hideHoverCard}
                  datasetName={datasetName}
                />
              }
              mouseEnterDelay={0.2}
              mouseLeaveDelay={0.2}
              onOpenChange={visible => {
                setIsHoverCardVisible(visible);
              }}
              open={isHoverCardVisible}
              arrow={false}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {displayTitle}
                {isRequired && <RequiredFieldIndicator />}
              </div>
            </Popover>
          }
        >
          <div
            onMouseEnter={setHoveredChartCustomization}
            onMouseLeave={unsetHoveredChartCustomization}
          >
            <Select
              allowClear
              autoClearSearchValue
              placeholder={t('Search columns...')}
              value={currentValue}
              onChange={handleColumnChange}
              options={columnOptions}
              showSearch
              mode={canSelectMultiple ? 'multiple' : undefined}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              sortComparator={sortComparator}
              getPopupContainer={triggerNode => triggerNode.parentNode}
              oneLine={isHorizontalLayout}
              className="select-container"
              loading={loading}
            />
          </div>
        </HorizontalFormItem>
      ) : (
        <div
          css={css`
            margin-bottom: ${theme.sizeUnit}px;
          `}
          onMouseEnter={setHoveredChartCustomization}
          onMouseLeave={unsetHoveredChartCustomization}
        >
          <Select
            allowClear
            autoClearSearchValue
            placeholder={t('Search columns...')}
            value={currentValue}
            onChange={handleColumnChange}
            options={columnOptions}
            showSearch
            mode={canSelectMultiple ? 'multiple' : undefined}
            filterOption={(input, option) =>
              ((option?.label as string) ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            sortComparator={sortComparator}
            loading={loading}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" />
        </div>
      )}
    </div>
  );
};

export default GroupByFilterCard;
