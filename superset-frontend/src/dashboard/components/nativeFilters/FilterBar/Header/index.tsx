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
import {
  FeatureFlag,
  css,
  isFeatureEnabled,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import React, { FC, useMemo } from 'react';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import FilterConfigurationLink from 'src/dashboard/components/nativeFilters/FilterBar/FilterConfigurationLink';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { RootState } from 'src/dashboard/types';
import { getFilterBarTestId } from '../utils';
import FilterBarSettings from '../FilterBarSettings';

const TitleArea = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    margin: 0;
    padding: 0 ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px;

    & > span {
      font-size: ${theme.typography.sizes.l}px;
      flex-grow: 1;
      font-weight: ${theme.typography.weights.bold};
    }

    & > div:first-of-type {
      line-height: 0;
    }

    & > button > span.anticon {
      line-height: 0;
    }
  `}
`;

const HeaderButton = styled(Button)`
  padding: 0;
`;

const Wrapper = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 3}px ${theme.gridUnit * 2}px ${
    theme.gridUnit
  }px;

    .ant-dropdown-trigger span {
      padding-right: ${theme.gridUnit * 2}px;
    }
  `}
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
  const filterValues = useMemo(() => Object.values(filters), [filters]);
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
        <FilterBarSettings />
        <HeaderButton
          {...getFilterBarTestId('collapse-button')}
          buttonStyle="link"
          buttonSize="xsmall"
          onClick={() => toggleFiltersBar(false)}
        >
          <Icons.Expand iconColor={theme.colors.grayscale.base} />
        </HeaderButton>
      </TitleArea>
      {canEdit && isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) && (
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

export default React.memo(Header);
