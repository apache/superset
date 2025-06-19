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
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'src/components/Form';
import Popover from 'src/components/Popover';
import { Typography, Select } from 'src/components';
import { Icons } from 'src/components/Icons';
import Loading from 'src/components/Loading';
import {
  styled,
  t,
  SupersetClient,
  css,
  useTruncation,
  DataMaskStateWithId,
  AdhocFilter,
} from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { debounce, isEqual } from 'lodash';
import { saveChartCustomization } from 'src/dashboard/actions/dashboardInfo';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { RootState } from '../../../types';
import { mergeExtraFormData } from '../utils';
import { ChartCustomizationItem } from './types';

interface GroupByFilterCardProps {
  customizationItem: ChartCustomizationItem;
}

interface FilterOption {
  label: string;
  value: string;
}

const Row = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.gridUnit}px 0;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;

  &:first-of-type {
    margin-top: 0;
  }

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const RowLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  padding-right: ${({ theme }) => theme.gridUnit * 4}px;
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
  padding: ${({ theme }) => theme.gridUnit}px 0;
`;

const FilterTitle = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
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
  padding: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

const Description = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  display: block;
`;

const GroupByFilterCardContent: FC<{
  customizationItem: ChartCustomizationItem;
  hidePopover: () => void;
}> = ({ customizationItem }) => {
  const { title, description, customization } = customizationItem;
  const { dataset, aggregation } = customization || {};
  const [titleRef, , titleTruncated] = useTruncation();

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
          margin-bottom: ${theme.gridUnit * 3}px;
          justify-content: flex-start;
        `}
      >
        <InternalRow>
          <Icons.GroupOutlined
            iconSize="s"
            css={theme => css`
              margin-right: ${theme.gridUnit}px;
            `}
          />
          <TooltipWithTruncation
            title={titleTruncated ? title || t('Group By') : null}
          >
            <Typography.Text strong ref={titleRef}>
              {title || t('Group By')}
            </Typography.Text>
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
            margin-top: ${theme.gridUnit * 2}px;
          `}
        >
          <Typography.Text
            type="secondary"
            css={theme => css`
              font-size: ${theme.typography.sizes.s - 1}px;
            `}
          >
            {description}
          </Typography.Text>
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

  const columnDisplayName = useMemo(() => {
    if (name) return name;
    if (typeof column === 'string') return column;
    return t('Group By');
  }, [column, name]);

  const columnName = useMemo(() => {
    if (typeof column === 'string') return column;
    if (name) return name;
    return null;
  }, [column, name]);

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

  const fetchFilterValues = useCallback(
    async (datasetId: string, columnName: string, search?: string) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();

        if (search) {
          queryParams.append('q', search);
        }

        if (dependencies && Object.keys(dependencies).length > 0) {
          queryParams.append('extra_form_data', JSON.stringify(dependencies));
        }

        const formData = {
          datasource: `${datasetId}__table`,
          viz_type: 'filter_select',
          adhoc_filters: [] as AdhocFilter[],
          extra_filters: [],
          extra_form_data: dependencies,
          granularity_sqla: 'ds',
          groupby: [columnName],
          metrics: ['count'],
          row_limit: 1000,
          time_range: 'No filter',
        };

        if (search) {
          formData.adhoc_filters = [
            {
              clause: 'WHERE',
              expressionType: 'SIMPLE',
              operator: 'ILIKE',
              subject: columnName,
              comparator: `%${search}%`,
            },
          ];
        }

        const chartDataEndpoint = '/api/v1/chart/data';
        const response = await SupersetClient.post({
          endpoint: chartDataEndpoint,
          jsonPayload: {
            form_data: formData,
          },
        });

        if (response?.json?.result) {
          const data = response.json.result[0]?.data || [];

          if (data.length > 0) {
            const uniqueValues = new Set();
            const formattedValues: FilterOption[] = [];

            data.forEach((row: any) => {
              const value = row[columnName];
              if (
                value !== null &&
                value !== undefined &&
                !uniqueValues.has(value)
              ) {
                uniqueValues.add(value);
                formattedValues.push({
                  label: value.toString(),
                  value: value.toString(),
                });
              }
            });

            formattedValues.sort((a, b) => a.label.localeCompare(b.label));
            setOptions(formattedValues);
          } else {
            setOptions([]);
          }
        } else {
          setOptions([]);
        }
      } catch (error) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [dependencies],
  );

  const handleSearch = useMemo(
    () =>
      debounce((search: string) => {
        if (dataset && columnName) {
          fetchFilterValues(dataset, columnName, search);
        }
      }, 300),
    [dataset, columnName, fetchFilterValues],
  );

  const handleValuesChange = (values: string[]) => {
    setSelectedValues(values || []);

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
  };

  const hideHoverCard = useCallback(() => {
    setIsHoverCardVisible(false);
  }, []);

  const displayTitle = columnDisplayName;

  const prevDependenciesRef = useRef(dependencies);

  useEffect(() => {
    if (dataset && columnName) {
      if (!isEqual(prevDependenciesRef.current, dependencies)) {
        fetchFilterValues(dataset, columnName);
      }
      prevDependenciesRef.current = dependencies;
    }
  }, [dataset, columnName, fetchFilterValues, dependencies]);

  useEffect(() => {
    if (dataset && columnName) {
      fetchFilterValues(dataset, columnName);
    }
  }, [dataset, columnName, fetchFilterValues]);

  useEffect(() => {
    if (!defaultValue) {
      setSelectedValues([]);
    } else if (Array.isArray(defaultValue)) {
      setSelectedValues(defaultValue);
    } else if (typeof defaultValue === 'string' && defaultValue.includes(',')) {
      setSelectedValues(defaultValue.split(','));
    } else {
      setSelectedValues([defaultValue.toString()]);
    }
  }, [defaultValue]);

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
          <TooltipWithTruncation
            title={titleElementsTruncated ? displayTitle : null}
          >
            <FilterTitle ref={filterTitleRef}>{displayTitle}</FilterTitle>
          </TooltipWithTruncation>
          {customizationItem.description && (
            <Description>{customizationItem.description}</Description>
          )}
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
