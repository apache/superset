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
import { styled, t } from '@superset-ui/core';
import { Collapse, Typography, Tooltip } from 'src/common/components';
import { DataMaskUnit } from 'src/dataMask/types';
import { CaretDownOutlined } from '@ant-design/icons';
import { areObjectsEqual } from 'src/reduxUtils';
import { FilterSet } from 'src/dashboard/reducers/types';
import { getFilterValueForDisplay } from './utils';
import { useFilters } from '../state';

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

const StyledCollapse = styled(Collapse)`
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

export type FiltersHeaderProps = {
  dataMask?: DataMaskUnit;
  filterSet?: FilterSet;
};

const FiltersHeader: FC<FiltersHeaderProps> = ({ dataMask, filterSet }) => {
  const filters = useFilters();
  const filterValues = Object.values(filters);

  let resultFilters = filterValues ?? [];
  if (filterSet?.nativeFilters) {
    resultFilters = Object.values(filterSet?.nativeFilters);
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
      !areObjectsEqual(filters[id], filterSet?.nativeFilters?.[id]);
    const removedFilter = !Object.keys(filters).includes(id);

    return (
      <Tooltip
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
        <div data-test="filter-info">
          <Typography.Text strong delete={removedFilter} mark={changedFilter}>
            {name}:&nbsp;
          </Typography.Text>
          <Typography.Text delete={removedFilter} mark={changedFilter}>
            {getFilterValueForDisplay(dataMask?.[id]?.currentState?.value) || (
              <Typography.Text type="secondary">{t('None')}</Typography.Text>
            )}
          </Typography.Text>
        </div>
      </Tooltip>
    );
  };

  return (
    <StyledCollapse
      ghost
      expandIconPosition="right"
      defaultActiveKey={!filterSet ? ['filters'] : undefined}
      expandIcon={({ isActive }: { isActive: boolean }) => (
        <CaretDownOutlined rotate={isActive ? 0 : 180} />
      )}
    >
      <Collapse.Panel header={getFiltersHeader()} key="filters">
        {resultFilters.map(getFilterRow)}
      </Collapse.Panel>
    </StyledCollapse>
  );
};

export default FiltersHeader;
