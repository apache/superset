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
import { DataMaskUnitWithId } from 'src/dataMask/types';
import { CheckOutlined, EllipsisOutlined } from '@ant-design/icons';
import { HandlerFunction, styled, t } from '@superset-ui/core';
import FiltersHeader from './FiltersHeader';
import { Filter } from '../../types';

const LineText = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

type FilterSetUnitProps = {
  filters: Filter[];
  editMode?: boolean;
  isApplied?: boolean;
  filterSet?: FilterSet;
  filterSetName?: string;
  currentDataMask: DataMaskUnitWithId;
  setFilterSetName?: (name: string) => void;
  onDelete: HandlerFunction;
};

const FilterSetUnit: FC<FilterSetUnitProps> = ({
  filters,
  editMode,
  setFilterSetName,
  onDelete,
  filterSetName,
  currentDataMask,
  filterSet,
  isApplied,
}) => {
  const menu = (
    <Menu>
      <Menu.Item onClick={onDelete}>{t('Delete')}</Menu.Item>
    </Menu>
  );
  return (
    <>
      <LineText>
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
        {isApplied && <CheckOutlined />}
        <Dropdown overlay={menu} placement="bottomRight">
          <EllipsisOutlined />
        </Dropdown>
      </LineText>
      <FiltersHeader
        expanded={!filterSet}
        dataMask={filterSet?.dataMask?.nativeFilters ?? currentDataMask}
        filters={filters}
      />
    </>
  );
};

export default FilterSetUnit;
