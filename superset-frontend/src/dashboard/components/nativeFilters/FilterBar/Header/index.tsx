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
/* eslint-disable no-param-reassign */
import { css, styled, t, useTheme } from '@superset-ui/core';
import React, { FC } from 'react';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import FilterConfigurationLink from 'src/dashboard/components/nativeFilters/FilterBar/FilterConfigurationLink';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { RootState } from 'src/dashboard/types';
import { getFilterBarTestId } from '..';

const TitleArea = styled.h4`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 0;
  padding: ${({ theme }) => theme.gridUnit * 2}px;

  & > span {
    flex-grow: 1;
  }
`;

const HeaderButton = styled(Button)`
  padding: 0;
`;

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit}px
    ${({ theme }) => theme.gridUnit * 2}px;
`;

type HeaderProps = {
  toggleFiltersBar: (arg0: boolean) => void;
};

const AddFiltersButtonContainer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit * 2}px;

    & button > [role='img']:first-of-type {
      margin-right: ${theme.gridUnit}px;
      line-height: 0;
    }

    span[role='img'] {
      padding-bottom: 1px;
    }

    .ant-btn > .anticon + span {
      margin-left: 0;
    }
  `}
`;

const Header: FC<HeaderProps> = ({ toggleFiltersBar }) => {
  const theme = useTheme();
  const filters = useFilters();
  const filterValues = Object.values(filters);
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  return (
    <Wrapper>
      <TitleArea>
        <span>{t('Filters')}</span>
        <HeaderButton
          {...getFilterBarTestId('collapse-button')}
          buttonStyle="link"
          buttonSize="xsmall"
          onClick={() => toggleFiltersBar(false)}
        >
          <Icons.Expand iconColor={theme.colors.grayscale.base} />
        </HeaderButton>
      </TitleArea>
      {canEdit && (
        <AddFiltersButtonContainer>
          <FilterConfigurationLink
            dashboardId={dashboardId}
            createNewOnOpen={filterValues.length === 0}
          >
            <Icons.PlusSmall /> {t('Add/Edit Filters')}
          </FilterConfigurationLink>
        </AddFiltersButtonContainer>
      )}
    </Wrapper>
  );
};

export default Header;
