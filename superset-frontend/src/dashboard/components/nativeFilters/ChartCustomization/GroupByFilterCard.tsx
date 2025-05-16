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
import { Form } from 'src/components/Form';
import Button from 'src/components/Button';
import Popover from 'src/components/Popover';
import { Typography, Tag, Select } from 'src/components';
import { Icons } from 'src/components/Icons';
import Loading from 'src/components/Loading';
import { styled, t, SupersetClient, css } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { debounce } from 'lodash';
import { saveChartCustomization } from 'src/dashboard/actions/dashboardInfo';
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

  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledTag = styled(Tag)`
  margin: ${({ theme }) => theme.gridUnit / 2}px;
  font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
  border-radius: ${({ theme }) => theme.gridUnit}px;
  padding: ${({ theme }) => theme.gridUnit / 2}px
    ${({ theme }) => theme.gridUnit}px;
  background: ${({ theme }) => theme.colors.primary.light4};
  border: 1px solid ${({ theme }) => theme.colors.primary.light2};
  color: ${({ theme }) => theme.colors.primary.dark1};
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TagContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  margin-top: ${({ theme }) => theme.gridUnit}px;
`;

const StyledSelect = styled.div`
  .ant-select {
    width: 100%;
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
}> = ({ customizationItem, hidePopover }) => {
  const { title, description, customization } = customizationItem;
  const { name, dataset, aggregation } = customization || {};

  const dispatch = useDispatch();

  const handleReset = () => {
    if (customizationItem) {
      const updatedCustomization = {
        ...customizationItem.customization,
        defaultValue: '',
      };

      dispatch(
        saveChartCustomization([
          {
            id: customizationItem.id,
            title: customizationItem.title,
            removed: customizationItem.removed,
            customization: updatedCustomization,
          },
        ]),
      );
      hidePopover();
    }
  };

  const datasetLabel = useMemo(() => {
    if (customizationItem.customization.dataset) {
      if (
        typeof customizationItem.customization.dataset === 'object' &&
        'label' in customizationItem.customization.dataset
      ) {
        return (customizationItem.customization.dataset as { label: string })
          .label;
      }
      return `Dataset ${dataset}`;
    }
    return t('Not set');
  }, [customizationItem.customization.dataset, dataset]);

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
          <Icons.BarChartOutlined
            iconSize="s"
            css={theme => css`
              margin-right: ${theme.gridUnit}px;
            `}
          />
          <Typography.Text strong>{title || t('Group By')}</Typography.Text>
        </InternalRow>
      </Row>
      <Row>
        <RowLabel>{t('Type')}</RowLabel>
        <RowValue>{t('Dynamic group by')}</RowValue>
      </Row>

      <Row>
        <RowLabel>{t('Name')}</RowLabel>
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

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button size="small" onClick={handleReset}>
          {t('Reset')}
        </Button>
      </div>
    </div>
  );
};

const GroupByFilterCard: FC<GroupByFilterCardProps> = ({
  customizationItem,
}) => {
  const { title, customization } = customizationItem;
  const { name, dataset, defaultValue } = customization || {};

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

  const fetchFilterValues = useCallback(
    async (datasetId: string, columnName: string, search?: string) => {
      setLoading(true);
      try {
        const endpoint = `/api/v1/dataset/${datasetId}/column/${columnName}/values${
          search ? `?q=${search}` : ''
        }`;

        const response = await SupersetClient.get({ endpoint });
        if (response?.json?.result) {
          const values = response.json.result.map((value: any) => ({
            label: value.toString(),
            value: value.toString(),
          }));
          setOptions(values);
        } else {
          setOptions([]);
        }
      } catch (error) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSearch = debounce((search: string) => {
    if (dataset && name) {
      fetchFilterValues(dataset, name, search);
    }
  }, 300);

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

  useEffect(() => {
    if (dataset && name) {
      fetchFilterValues(dataset, name);
    }
  }, [dataset, name, fetchFilterValues]);

  return (
    <FilterValueContainer>
      <Popover
        placement="right"
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
        <div>
          <FilterTitle>
            {title || t('Group By')}: {name || t('None')}
          </FilterTitle>
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
            />
          </StyledSelect>
        </Form.Item>
      </Form>

      {selectedValues.length > 0 ? (
        <TagContainer>
          {selectedValues.map(value => (
            <StyledTag key={value}>{value}</StyledTag>
          ))}
        </TagContainer>
      ) : (
        !loading && <NoDataMessage>{t('No selection')}</NoDataMessage>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" />
        </div>
      )}

      {!loading && options.length === 0 && (
        <NoDataMessage>{t('No data available')}</NoDataMessage>
      )}
    </FilterValueContainer>
  );
};

export default GroupByFilterCard;
