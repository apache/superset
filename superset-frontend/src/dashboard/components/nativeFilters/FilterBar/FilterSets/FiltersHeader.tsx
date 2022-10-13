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
import React, { FC } from 'react';
import {
  DataMaskState,
  FilterSet,
  isNativeFilter,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Typography, AntdTooltip, AntdCollapse } from 'src/components';
import Icons from 'src/components/Icons';
import { areObjectsEqual } from 'src/reduxUtils';
import { getFilterValueForDisplay } from './utils';
import { useFilters } from '../state';
import { getFilterBarTestId } from '../index';

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

const StyledCollapse = styled(AntdCollapse)`
  &.ant-collapse-ghost > .ant-collapse-item {
    & > .ant-collapse-content > .ant-collapse-content-box {
      padding: 0;
      padding-top: 0;
      padding-bottom: 0;
      font-size: ${({ theme }) => theme.typography.sizes.s}px;
    }
    & > .ant-collapse-header {
      padding: 0;
      display: flex;
      align-items: center;
      flex-direction: row-reverse;
      justify-content: flex-end;
      max-width: max-content;
      & .ant-collapse-arrow {
        position: static;
        padding-left: ${({ theme }) => theme.gridUnit}px;
      }
  }
`;

const StyledFilterRow = styled.div`
  padding-top: ${({ theme }) => theme.gridUnit}px;
  padding-bottom: ${({ theme }) => theme.gridUnit}px;
`;

export type FiltersHeaderProps = {
  dataMask?: DataMaskState;
  filterSet?: FilterSet;
};

const FiltersHeader: FC<FiltersHeaderProps> = ({ dataMask, filterSet }) => {
  const theme = useTheme();
  const filters = useFilters();
  const filterValues = Object.values(filters).filter(isNativeFilter);

  let resultFilters = filterValues ?? [];
  if (filterSet?.nativeFilters) {
    resultFilters = Object.values(filterSet?.nativeFilters).filter(
      isNativeFilter,
    );
  }

  const getFiltersHeader = () => (
    <FilterHeader>
      <Typography.Text type="secondary">
        {t('Filters (%d)', resultFilters.length)}
      </Typography.Text>
    </FilterHeader>
  );

  const getFilterRow = ({ id, name }: { id: string; name: string }) => {
    const changedFilter =
      filterSet &&
      !areObjectsEqual(
        filters[id]?.controlValues,
        filterSet?.nativeFilters?.[id]?.controlValues,
        {
          ignoreUndefined: true,
        },
      );
    const removedFilter = !Object.keys(filters).includes(id);

    return (
      <AntdTooltip
        title={
          (removedFilter &&
            t(
              "This filter doesn't exist in dashboard. It will not be applied.",
            )) ||
          (changedFilter &&
            t('Filter metadata changed in dashboard. It will not be applied.'))
        }
        placement="bottomLeft"
        key={id}
      >
        <StyledFilterRow data-test="filter-info">
          <Typography.Text strong delete={removedFilter} mark={changedFilter}>
            {name}:&nbsp;
          </Typography.Text>
          <Typography.Text delete={removedFilter} mark={changedFilter}>
            {getFilterValueForDisplay(dataMask?.[id]?.filterState?.value) || (
              <Typography.Text type="secondary">{t('None')}</Typography.Text>
            )}
          </Typography.Text>
        </StyledFilterRow>
      </AntdTooltip>
    );
  };

  const getExpandIcon = ({ isActive }: { isActive: boolean }) => {
    const color = theme.colors.grayscale.base;
    const Icon = isActive ? Icons.CaretUpOutlined : Icons.CaretDownOutlined;
    return <Icon iconColor={color} />;
  };

  return (
    <StyledCollapse
      ghost
      expandIconPosition="right"
      defaultActiveKey={!filterSet ? ['filters'] : undefined}
      expandIcon={getExpandIcon}
    >
      <AntdCollapse.Panel
        {...getFilterBarTestId('collapse-filter-set-description')}
        header={getFiltersHeader()}
        key="filters"
      >
        {resultFilters.map(getFilterRow)}
      </AntdCollapse.Panel>
    </StyledCollapse>
  );
};

export default FiltersHeader;
