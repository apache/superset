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
import React, { useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { FormItem as StyledFormItem, Form } from 'src/components/Form';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { theme as supersetTheme } from 'src/preamble';
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
  .ant-form-item-tooltip {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const FormItem = styled(StyledFormItem)`
  ${({ theme }) => `
    .ant-form-item-label {
      label.ant-form-item-required:not(.ant-form-item-required-mark-optional){
        &::after {
          display: none;
        }
      }
    }
`}
`;

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  display: flex;
`;

const RequiredFieldIndicator = () => (
  <span
    css={{
      color: supersetTheme.colors.error.base,
      fontSize: `${supersetTheme.typography.sizes.s}px`,
      paddingLeft: '2px',
    }}
  >
    *
  </span>
);

const DescriptoinToolTip = ({ description }: { description: string }) => (
  <ToolTipContainer>
    <Tooltip
      title={description}
      placement="top"
      overlayInnerStyle={{
        display: '-webkit-box',
        overflow: 'hidden',
        // @ts-ignore -webkit-line-clamp is not in the CSS type
        '-webkit-line-clamp': '20',
        '-webkit-box-orient': 'vertical',
        'text-overflow': 'ellipsis',
      }}
    >
      <Icons.InfoCircle
        className="text-muted"
        css={{ color: supersetTheme.colors.grayscale.light1 }}
      />
    </Tooltip>
  </ToolTipContainer>
);
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
  const isRequired = !!filter.controlValues?.enableEmptyFilter;

  const label = useMemo(
    () => (
      <StyledFilterControlTitleBox>
        <StyledFilterControlTitle data-test="filter-control-name">
          {name}
        </StyledFilterControlTitle>
        {isRequired && <RequiredFieldIndicator />}
        {filter.description && filter.description.trim() && (
          <DescriptoinToolTip description={filter.description} />
        )}
        <StyledIcon data-test="filter-icon">{icon}</StyledIcon>
      </StyledFilterControlTitleBox>
    ),
    [name, isRequired, filter.description, icon],
  );

  return (
    <StyledFilterControlContainer layout="vertical">
      <FormItem
        label={label}
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
export default React.memo(FilterControl);
