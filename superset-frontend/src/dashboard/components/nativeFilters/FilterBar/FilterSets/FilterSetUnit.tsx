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
import { AntdDropdown, Typography } from 'src/components';
import { Menu } from 'src/components/Menu';
import React, { FC } from 'react';
import {
  DataMaskState,
  FilterSet,
  HandlerFunction,
  styled,
  useTheme,
  t,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { Tooltip } from 'src/components/Tooltip';
import FiltersHeader from './FiltersHeader';
import { getFilterBarTestId } from '../utils';

const HeaderButton = styled(Button)`
  padding: 0;
`;

const TitleText = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const IconsBlock = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  & > *,
  & > button.superset-button {
    ${({ theme }) => `margin-left: ${theme.gridUnit * 2}px`};
  }
`;

export type FilterSetUnitProps = {
  editMode?: boolean;
  isApplied?: boolean;
  filterSet?: FilterSet;
  filterSetName?: string;
  dataMaskSelected?: DataMaskState;
  setFilterSetName?: (name: string) => void;
  onDelete?: HandlerFunction;
  onEdit?: HandlerFunction;
  onRebuild?: HandlerFunction;
};

const FilterSetUnit: FC<FilterSetUnitProps> = ({
  editMode,
  setFilterSetName,
  onDelete,
  onEdit,
  filterSetName,
  dataMaskSelected,
  filterSet,
  isApplied,
  onRebuild,
}) => {
  const theme = useTheme();

  const menu = (
    <Menu>
      <Menu.Item onClick={onEdit}>{t('Edit')}</Menu.Item>
      <Menu.Item onClick={onRebuild}>
        <Tooltip placement="right" title={t('Remove invalid filters')}>
          {t('Rebuild')}
        </Tooltip>
      </Menu.Item>
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
            <Icons.CheckOutlined
              iconSize="m"
              iconColor={theme.colors.success.base}
            />
          )}
          {onDelete && (
            <AntdDropdown
              overlay={menu}
              placement="bottomRight"
              trigger={['click']}
            >
              <HeaderButton
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                {...getFilterBarTestId('filter-set-menu-button')}
                buttonStyle="link"
                buttonSize="xsmall"
              >
                <Icons.EllipsisOutlined iconSize="m" />
              </HeaderButton>
            </AntdDropdown>
          )}
        </IconsBlock>
      </TitleText>
      <FiltersHeader
        filterSet={filterSet}
        dataMask={filterSet?.dataMask ?? dataMaskSelected}
      />
    </>
  );
};

export default FilterSetUnit;
