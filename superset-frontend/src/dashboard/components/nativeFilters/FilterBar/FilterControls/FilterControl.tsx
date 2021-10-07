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
import React from 'react';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { styled, t } from '@superset-ui/core';
import { Form, FormItem } from 'src/components/Form';
import { checkIsMissingRequiredValue } from '../utils';
import FilterValue from './FilterValue';
import { FilterProps } from './types';

const StyledIcon = styled.div`
  position: absolute;
  right: 0;
`;

const StyledFilterControlTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: break-word;
`;

const StyledFilterControlTitleBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const StyledFilterControlContainer = styled(Form)`
  width: 100%;
  && .ant-form-item-label > label {
    text-transform: none;
    width: 100%;
    padding-right: ${({ theme }) => theme.gridUnit * 11}px;
  }
`;

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  display: flex;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

const FilterControl: React.FC<FilterProps> = ({
  dataMaskSelected,
  filter,
  icon,
  onFilterSelectionChange,
  directPathToChild,
  inView,
}) => {
  const { name = '<undefined>' } = filter;

  const isMissingRequiredValue = checkIsMissingRequiredValue(
    filter,
    filter.dataMask?.filterState,
  );

  return (
    <StyledFilterControlContainer layout="vertical">
      <FormItem
        label={
          <StyledFilterControlTitleBox>
            <StyledFilterControlTitle data-test="filter-control-name">
              {name}
            </StyledFilterControlTitle>{' '}
            {!!filter.description && (
              <ToolTipContainer
                data-test="filter-description"
                className="text-muted"
              >
                <InfoTooltipWithTrigger
                  label={t('description')}
                  tooltip={filter.description}
                  placement="top"
                />
              </ToolTipContainer>
            )}
            <StyledIcon data-test="filter-icon">{icon}</StyledIcon>
          </StyledFilterControlTitleBox>
        }
        required={filter?.controlValues?.enableEmptyFilter}
        validateStatus={isMissingRequiredValue ? 'error' : undefined}
      >
        <FilterValue
          dataMaskSelected={dataMaskSelected}
          filter={filter}
          directPathToChild={directPathToChild}
          onFilterSelectionChange={onFilterSelectionChange}
          inView={inView}
        />
      </FormItem>
    </StyledFilterControlContainer>
  );
};

export default FilterControl;
