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
import { t, DataMaskStateWithId, useTruncation } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import {
  Typography,
  Select,
  Popover,
  Loading,
  Icons,
  Tooltip,
  FormItem,
} from '@superset-ui/core/components';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import {
  setPendingChartCustomization,
  loadChartCustomizationData,
} from 'src/dashboard/actions/chartCustomizationActions';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { dispatchChartCustomizationHoverAction } from '../FilterBar/FilterControls/utils';
import { mergeExtraFormData } from '../utils';
import { ChartCustomizationItem } from './types';

interface GroupByFilterCardProps {
  customizationItem: ChartCustomizationItem;
  orientation?: 'vertical' | 'horizontal';
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
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
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

  /* Allow dropdown to expand beyond form item width */
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
    css={(theme: any) => ({
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

const GroupByFilterCardContent: FC<{
  customizationItem: ChartCustomizationItem;
  hidePopover: () => void;
}> = ({ customizationItem }) => {
  const { description, customization } = customizationItem;
  const { dataset, name } = customization || {};
  const [titleRef, , titleTruncated] = useTruncation();
  const displayName = name?.trim() || t('Dynamic group by');

  const datasetLabel = useMemo(() => {
    const { datasetInfo, dataset: datasetValue } =
      customizationItem.customization;

    if (datasetInfo) {
      if ('table_name' in datasetInfo) {
        return (datasetInfo as { table_name: string }).table_name;
      }
      if ('label' in datasetInfo) {
        const { label } = datasetInfo as { label: string };
        const tableNameMatch = label.match(/^([^([]+)/);
        return tableNameMatch ? tableNameMatch[1].trim() : label;
      }
    }

    if (datasetValue) {
      if (typeof datasetValue === 'object' && 'label' in datasetValue) {
        const { label } = datasetValue as { label: string };
        const tableNameMatch = label.match(/^([^([]+)/);
        return tableNameMatch ? tableNameMatch[1].trim() : label;
      }
      if (typeof datasetValue === 'object' && 'table_name' in datasetValue) {
        return (datasetValue as { table_name: string }).table_name;
      }
      return `Dataset ${dataset}`;
    }
    return t('Not set');
  }, [
    customizationItem.customization.dataset,
    customizationItem.customization.datasetInfo,
    dataset,
  ]);

  const aggregationDisplay = useMemo(() => {
    if (customization.sortMetric) {
      return customization.sortMetric.toUpperCase();
    }
    return t('None');
  }, [customization.sortMetric]);

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
        <RowLabel>{t('Dataset')}</RowLabel>
        <RowValue>
          {typeof datasetLabel === 'string' ? datasetLabel : 'Dataset'}
        </RowValue>
      </Row>

      <Row>
        <RowLabel>{t('Aggregation')}</RowLabel>
        <RowValue>{aggregationDisplay}</RowValue>
      </Row>

      {description && (
        <Row
          css={theme => css`
            margin-top: ${theme.sizeUnit * 2}px;
          `}
        >
          <DescriptionTooltip description={description} />
        </Row>
      )}
    </div>
  );
};

const GroupByFilterCard: FC<GroupByFilterCardProps> = ({
  customizationItem,
  orientation = 'vertical',
}) => {
  const theme = useTheme();
  const { customization } = customizationItem;
  const { dataset } = customization || {};
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();

  const [loading, setLoading] = useState(false);
  const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);
  const [columnOptions, setColumnOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const dispatch = useDispatch();

  const isHorizontalLayout = orientation === 'horizontal';

  const hideHoverCard = useCallback(() => {
    setIsHoverCardVisible(false);
  }, []);

  const setHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch, customizationItem.id),
    [dispatch, customizationItem.id],
  );

  const unsetHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch),
    [dispatch],
  );

  const isRequired = useMemo(
    () => !!customizationItem.customization?.controlValues?.enableEmptyFilter,
    [customizationItem.customization?.controlValues?.enableEmptyFilter],
  );

  const chartCustomizationLoading = useSelector<RootState, boolean>(
    state =>
      state.dashboardInfo.chartCustomizationLoading?.[customizationItem.id] ||
      false,
  );

  const datasetId = useMemo(() => {
    if (!dataset) return null;

    if (typeof dataset === 'string') {
      return dataset;
    }

    if (typeof dataset === 'object' && dataset !== null) {
      if ('value' in dataset) {
        return String((dataset as { value: string | number }).value);
      }
      if ('id' in dataset) {
        return String((dataset as { id: string | number }).id);
      }
    }

    return null;
  }, [dataset]);

  const columnName = customizationItem.customization?.column;
  const canSelectMultiple =
    customizationItem.customization?.canSelectMultiple ?? true;

  const columnDisplayName = useMemo(() => {
    if (customizationItem.customization?.name) {
      return customizationItem.customization.name;
    }
    if (customizationItem.title) {
      return customizationItem.title;
    }
    if (columnName) {
      return columnName;
    }
    return t('Group By');
  }, [
    customizationItem.customization?.name,
    customizationItem.title,
    columnName,
  ]);

  const useChartCustomizationDependencies = () => {
    const dataMask = useSelector<RootState, DataMaskStateWithId>(
      state => state.dataMask,
    );
    const filters = useSelector<RootState, any>(
      state => state.nativeFilters.filters,
    );

    return useMemo(() => {
      let dependencies = {};

      Object.entries(filters).forEach(([filterId, filter]: [string, any]) => {
        if (
          filter.type === 'DIVIDER' ||
          !dataMask[filterId]?.filterState?.value
        ) {
          return;
        }

        const filterState = dataMask[filterId];
        dependencies = mergeExtraFormData(
          dependencies,
          filterState?.extraFormData,
        );
      });

      return dependencies;
    }, [dataMask, filters]);
  };

  const dependencies = useChartCustomizationDependencies();

  useEffect(() => {
    if (datasetId && columnName) {
      dispatch(
        loadChartCustomizationData(customizationItem.id, datasetId, columnName),
      );
    }
  }, [datasetId, columnName, dispatch, customizationItem.id, dependencies]);

  useEffect(() => {
    setLoading(chartCustomizationLoading);
  }, [chartCustomizationLoading]);

  useEffect(() => {
    const fetchColumnOptions = async () => {
      if (!dataset) return;

      try {
        const datasetId =
          typeof dataset === 'string'
            ? dataset
            : typeof dataset === 'object' &&
                dataset !== null &&
                'value' in dataset
              ? (dataset as { value: string | number }).value
              : null;

        if (!datasetId) return;

        const response = await fetch(`/api/v1/dataset/${datasetId}`);
        const data = await response.json();

        if (data?.result?.columns) {
          const options = data.result.columns
            .filter((col: any) => col.filterable !== false)
            .map((col: any) => ({
              label: col.verbose_name || col.column_name || col.name,
              value: col.column_name || col.name,
            }));
          setColumnOptions(options);
        }
      } catch (error) {
        console.warn('Failed to fetch column options:', error);
        setColumnOptions([]);
      }
    };

    fetchColumnOptions();
  }, [dataset]);

  const displayTitle = columnDisplayName;

  const description =
    customizationItem.description?.trim() ||
    customizationItem.customization.description?.trim();

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
              value={columnName || null}
              onChange={(value: string | string[]) => {
                const columnValue = canSelectMultiple
                  ? Array.isArray(value)
                    ? value.length > 0
                      ? value
                      : null
                    : value || null
                  : typeof value === 'string'
                    ? value
                    : null;

                const updatedCustomization = {
                  ...customizationItem.customization,
                  column: columnValue,
                };

                dispatch(
                  setPendingChartCustomization({
                    id: customizationItem.id,
                    title: customizationItem.title,
                    customization: updatedCustomization,
                  }),
                );
              }}
              options={columnOptions}
              showSearch
              mode={canSelectMultiple ? 'multiple' : undefined}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              getPopupContainer={triggerNode => triggerNode.parentNode}
              oneLine={isHorizontalLayout}
              className="select-container"
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
            value={columnName || null}
            onChange={(value: string | string[]) => {
              const columnValue = canSelectMultiple
                ? Array.isArray(value)
                  ? value.length > 0
                    ? value
                    : null
                  : value || null
                : typeof value === 'string'
                  ? value
                  : null;

              const updatedCustomization = {
                ...customizationItem.customization,
                column: columnValue,
              };

              dispatch(
                setPendingChartCustomization({
                  id: customizationItem.id,
                  title: customizationItem.title,
                  customization: updatedCustomization,
                }),
              );
            }}
            options={columnOptions}
            showSearch
            mode={canSelectMultiple ? 'multiple' : undefined}
            filterOption={(input, option) =>
              ((option?.label as string) ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
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
