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
import {
  Typography,
  Select,
  Icons,
  Loading,
  Popover,
  Tooltip,
} from '@superset-ui/core/components';
import {
  styled,
  t,
  css,
  useTruncation,
  DataMaskStateWithId,
  DataMask,
  useTheme,
} from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import {
  saveChartCustomization,
  loadChartCustomizationData,
} from 'src/dashboard/actions/dashboardInfo';
import { updateDataMask } from 'src/dataMask/actions';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { RootState } from '../../../types';
import { mergeExtraFormData } from '../utils';
import { ChartCustomizationItem } from './types';

interface GroupByFilterCardProps {
  customizationItem: ChartCustomizationItem;
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
  color: ${({ theme }) => theme.colors.grayscale.base};
  padding-right: ${({ theme }) => theme.sizeUnit * 4}px;
  margin-right: auto;
  white-space: nowrap;
`;

const RowValue = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark1};
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

const FilterValueContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: ${({ theme }) => theme.sizeUnit}px 0;
`;

const FilterTitle = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-weight: 600;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledSelect = styled.div`
  .ant-select {
    width: 100%;
  }

  /* Ensure the dropdown is fully interactive */
  .ant-select-selector {
    cursor: pointer !important;
  }

  /* Make sure dropdown shows on click */
  .ant-select-selection-search {
    cursor: pointer;
  }
`;

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSize}px;
  display: flex;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

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
  const { dataset, aggregation, name } = customization || {};
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
        return (datasetInfo as { label: string }).label;
      }
    }

    if (datasetValue) {
      if (typeof datasetValue === 'object' && 'label' in datasetValue) {
        return (datasetValue as { label: string }).label;
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

  const aggregationDisplay = useMemo(
    () => (aggregation ? aggregation.toUpperCase() : t('None')),
    [aggregation],
  );

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
        <RowValue>{datasetLabel}</RowValue>
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
}) => {
  const theme = useTheme();
  const { customization } = customizationItem;
  const { name, dataset, column } = customization || {};
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();

  const [loading, setLoading] = useState(false);
  const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);
  const [columnOptions, setColumnOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const dispatch = useDispatch();

  const customizationFilterId = useMemo(
    () => `chart_customization_${customizationItem.id}`,
    [customizationItem.id],
  );

  const currentDataMask = useSelector<RootState, DataMask | undefined>(
    state => state.dataMask[customizationFilterId],
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
        return String((dataset as any).value);
      }
      if ('id' in dataset) {
        return String((dataset as any).id);
      }
    }

    return null;
  }, [dataset]);

  const columnName = useMemo(() => {
    if (!column) return null;

    // Check if there's a pending column change in the data mask
    const pendingColumn = currentDataMask?.ownState?.column;
    if (pendingColumn) {
      return pendingColumn;
    }

    if (typeof column === 'string') {
      return column;
    }

    if (typeof column === 'object' && column !== null) {
      if ('column_name' in column) {
        return (column as any).column_name;
      }
      if ('name' in column) {
        return (column as any).name;
      }
    }

    return null;
  }, [column, currentDataMask?.ownState?.column]);

  const columnDisplayName = useMemo(() => {
    if (name) return name;
    if (columnName) return columnName;
    return t('Group By');
  }, [columnName, name]);

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
              ? (dataset as any).value
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

  const hideHoverCard = useCallback(() => {
    setIsHoverCardVisible(false);
  }, []);

  const displayTitle = columnDisplayName;

  const description =
    customizationItem.description?.trim() ||
    customizationItem.customization.description?.trim();

  return (
    <FilterValueContainer>
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
        <div>
          <div
            css={css`
              display: flex;
              align-items: center;
            `}
          >
            <TooltipWithTruncation
              title={titleElementsTruncated ? displayTitle : null}
            >
              <div ref={filterTitleRef}>
                <FilterTitle>{displayTitle}</FilterTitle>
              </div>
            </TooltipWithTruncation>
            {description && <DescriptionTooltip description={description} />}
          </div>
        </div>
      </Popover>

      {/* Column Selection */}
      <div
        css={css`
          margin-bottom: ${theme.sizeUnit * 2}px;
        `}
      >
        <StyledSelect>
          <Select
            allowClear
            placeholder={t('Search columns...')}
            value={columnName || null}
            onChange={(value: string) => {
              if (value) {
                dispatch(
                  updateDataMask(customizationFilterId, {
                    filterState: {
                      value: undefined,
                    },
                    extraFormData: {},
                    ownState: {
                      column: value,
                    },
                  }),
                );

                const updatedCustomization = {
                  ...customizationItem.customization,
                  column: value,
                };

                dispatch(
                  saveChartCustomization([
                    {
                      id: customizationItem.id,
                      title: customizationItem.title,
                      customization: updatedCustomization,
                    },
                  ]),
                );
              }
            }}
            options={columnOptions}
            showSearch
            filterOption={(input, option) =>
              ((option?.label as string) ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </StyledSelect>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" />
        </div>
      )}
    </FilterValueContainer>
  );
};

export default GroupByFilterCard;
