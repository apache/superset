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
import { Typography, Dropdown, Menu } from 'src/common/components';
import React, { FC } from 'react';
import { FilterSet } from 'src/dashboard/reducers/types';
import { DataMaskUnit } from 'src/dataMask/types';
import { CheckOutlined, EllipsisOutlined } from '@ant-design/icons';
import { HandlerFunction, styled, supersetTheme, t } from '@superset-ui/core';
import FiltersHeader from './FiltersHeader';
import { Filter } from '../../types';

const TitleText = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const IconsBlock = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  & > * {
    ${({ theme }) => `padding-left: ${theme.gridUnit * 2}px`};
  }
`;

type FilterSetUnitProps = {
  filters: Filter[];
  editMode?: boolean;
  isApplied?: boolean;
  filterSet?: FilterSet;
  filterSetName?: string;
  dataMaskApplied?: DataMaskUnit;
  setFilterSetName?: (name: string) => void;
  onDelete?: HandlerFunction;
  onEdit?: HandlerFunction;
};

const FilterSetUnit: FC<FilterSetUnitProps> = ({
  filters,
  editMode,
  setFilterSetName,
  onDelete,
  onEdit,
  filterSetName,
  dataMaskApplied,
  filterSet,
  isApplied,
}) => {
  const menu = (
    <Menu>
      <Menu.Item onClick={onEdit}>{t('Edit')}</Menu.Item>
      <Menu.Item onClick={onDelete} danger>
        {t('Delete')}
      </Menu.Item>
    </Menu>
  );
  return (
    <>
      <TitleText>
        <Typography.Text
          strong
          editable={{
            editing: editMode,
            icon: <span />,
            onChange: setFilterSetName,
          }}
        >
          {filterSet?.name ?? filterSetName}
        </Typography.Text>
        <IconsBlock>
          {isApplied && (
            <CheckOutlined
              style={{ color: supersetTheme.colors.success.base }}
            />
          )}
          {onDelete && (
            <Dropdown
              overlay={menu}
              placement="bottomRight"
              trigger={['click']}
            >
              <EllipsisOutlined
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              />
            </Dropdown>
          )}
        </IconsBlock>
      </TitleText>
      <FiltersHeader
        expanded={!filterSet}
        dataMask={filterSet?.dataMask?.nativeFilters ?? dataMaskApplied}
        filters={filters}
      />
    </>
  );
};

export default FilterSetUnit;
