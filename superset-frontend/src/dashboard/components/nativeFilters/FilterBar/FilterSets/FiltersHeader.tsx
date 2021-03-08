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
import { Collapse, Typography } from 'src/common/components';
import { DataMaskUnitWithId } from 'src/dataMask/types';
import { getFilterValueForDisplay } from './utils';
import { Filter } from '../../types';

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
      & .ant-collapse-arrow {
        position: static;
        padding-left: ${({ theme }) => theme.gridUnit}px;
      }
  }
`;

type FiltersHeaderProps = {
  filters: Filter[];
  dataMask: DataMaskUnitWithId;
};

const FiltersHeader: FC<FiltersHeaderProps> = ({ filters, dataMask }) => {
  const getFiltersHeader = () => (
    <FilterHeader>
      <Typography.Text type="secondary">
        {t('Filters (%d)', filters.length)}
      </Typography.Text>
    </FilterHeader>
  );
  return (
    <StyledCollapse
      ghost
      expandIconPosition="right"
      defaultActiveKey={['filters']}
    >
      <Collapse.Panel header={getFiltersHeader()} key="filters">
        {filters.map(({ id, name }) => (
          <div>
            <Typography.Text strong>{name}:&nbsp;</Typography.Text>
            <Typography.Text>
              {getFilterValueForDisplay(dataMask[id]?.currentState?.value) || (
                <Typography.Text type="secondary">{t('None')}</Typography.Text>
              )}
            </Typography.Text>
          </div>
        ))}
      </Collapse.Panel>
    </StyledCollapse>
  );
};

export default FiltersHeader;
