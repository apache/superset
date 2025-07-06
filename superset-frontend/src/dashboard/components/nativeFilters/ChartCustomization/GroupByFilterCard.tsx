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
  Form,
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
} from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash';
import {
  saveChartCustomization,
  loadChartCustomizationData,
} from 'src/dashboard/actions/dashboardInfo';
import { updateDataMask } from 'src/dataMask/actions';
import {
  postChartFormData,
  updateQueryFormData,
} from 'src/components/Chart/chartAction';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { RootState } from '../../../types';
import { mergeExtraFormData } from '../utils';
import { ChartCustomizationItem, FilterOption } from './types';

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

const NoDataMessage = styled.div`
  padding: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  text-align: center;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
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
  const { customization } = customizationItem;
  const { name, dataset, defaultValue, column } = customization || {};
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();

  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(() => {
    if (!defaultValue) return [];

    if (Array.isArray(defaultValue)) return defaultValue;

    if (typeof defaultValue === 'string' && defaultValue.includes(',')) {
      return defaultValue.split(',');
    }

    return [defaultValue.toString()];
  });
  const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);

  const dispatch = useDispatch();

  const chart = useSelector((state: RootState) =>
    customizationItem?.chartId
      ? state.charts?.[customizationItem.chartId]
      : null,
  );

  const customizationFilterId = useMemo(
    () => `chart_customization_${customizationItem.id}`,
    [customizationItem.id],
  );

  const chartCustomizationData = useSelector<RootState, FilterOption[]>(
    state =>
      state.dashboardInfo.chartCustomizationData?.[customizationItem.id] || [],
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
  }, [column]);

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

  const currentDataMask = useSelector<RootState, DataMask | undefined>(
    state => state.dataMask[customizationFilterId],
  );

  const handleSearch = useMemo(
    () =>
      debounce(() => {
        if (datasetId && columnName) {
          dispatch(
            loadChartCustomizationData(
              customizationItem.id,
              datasetId,
              columnName,
            ),
          );
        }
      }, 300),
    [datasetId, columnName, dispatch, customizationItem.id],
  );

  useEffect(() => {
    if (datasetId && columnName) {
      dispatch(
        loadChartCustomizationData(customizationItem.id, datasetId, columnName),
      );
    }
  }, [datasetId, columnName, dispatch, customizationItem.id]);

  useEffect(() => {
    if (datasetId && columnName) {
      dispatch(
        loadChartCustomizationData(customizationItem.id, datasetId, columnName),
      );
    }
  }, [datasetId, columnName, dispatch, customizationItem.id, dependencies]);

  useEffect(() => {
    if (datasetId && columnName) {
      dispatch(
        loadChartCustomizationData(customizationItem.id, datasetId, columnName),
      );
    }
  }, [datasetId, columnName, dispatch, customizationItem.id]);

  useEffect(() => {
    setOptions(chartCustomizationData);
  }, [chartCustomizationData]);

  useEffect(() => {
    setLoading(chartCustomizationLoading);
  }, [chartCustomizationLoading]);

  useEffect(() => {
    if (!currentDataMask && datasetId && columnName) {
      dispatch(
        updateDataMask(customizationFilterId, {
          filterState: {
            value: selectedValues.length > 0 ? selectedValues : undefined,
          },
          extraFormData: {},
          ownState: {},
        }),
      );
    }
  }, [
    currentDataMask,
    datasetId,
    columnName,
    selectedValues,
    dispatch,
    customizationFilterId,
  ]);

  // Update selectedValues when defaultValue changes
  useEffect(() => {
    let newSelectedValues: string[] = [];

    if (defaultValue) {
      if (Array.isArray(defaultValue)) {
        newSelectedValues = defaultValue;
      } else if (
        typeof defaultValue === 'string' &&
        defaultValue.includes(',')
      ) {
        newSelectedValues = defaultValue.split(',');
      } else {
        newSelectedValues = [defaultValue.toString()];
      }
    }

    setSelectedValues(newSelectedValues);
  }, [JSON.stringify(defaultValue)]);

  const handleValuesChange = (values: string[]) => {
    setSelectedValues(values || []);

    dispatch(
      updateDataMask(customizationFilterId, {
        filterState: {
          value: values && values.length > 0 ? values : undefined,
        },
        extraFormData: {},
        ownState: {},
      }),
    );

    if (customizationItem) {
      const updatedCustomization = {
        ...customizationItem.customization,
        defaultValue:
          values && values.length > 0 ? values.join(',') : undefined,
        defaultValueArray: values && values.length > 0 ? values : undefined,
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

    if (customizationItem?.chartId && chart?.latestQueryFormData) {
      const { latestQueryFormData } = chart;

      const newFormData = {
        ...latestQueryFormData,
        groupby: values && values.length > 0 ? values : [],
      };

      dispatch(updateQueryFormData(newFormData, customizationItem.chartId));
      dispatch(
        postChartFormData(
          newFormData,
          false,
          undefined,
          customizationItem.chartId,
          undefined,
          undefined,
        ),
      );
    }
  };

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

      <Form initialValues={{ values: selectedValues }}>
        <Form.Item name="values" noStyle>
          <StyledSelect>
            <Select
              mode="multiple"
              placeholder={t('Select values')}
              options={options}
              loading={loading}
              onSearch={handleSearch}
              filterOption={false}
              showSearch
              autoClearSearchValue
              allowClear
              onChange={handleValuesChange}
              value={selectedValues}
              showArrow
            />
          </StyledSelect>
        </Form.Item>
      </Form>

      {selectedValues.length === 0 && !loading && (
        <NoDataMessage>{t('No selection')}</NoDataMessage>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" />
        </div>
      )}

      {!loading && options.length === 0 && columnName && (
        <NoDataMessage>{t('No data available')}</NoDataMessage>
      )}
    </FilterValueContainer>
  );
};

export default GroupByFilterCard;
