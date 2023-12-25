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
import { styled, css, useTheme, useCSSTextTruncation } from '@superset-ui/core';
import { CrossFilterIndicator } from 'src/dashboard/components/nativeFilters/selectors';
import { Tag } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import { FilterBarOrientation } from 'src/dashboard/types';
import { ellipsisCss } from './styles';

const StyledCrossFilterValue = styled.b`
  ${({ theme }) => `
    max-width: ${theme.gridUnit * 25}px;
  `}
  ${ellipsisCss}
`;

const StyledCrossFilterColumn = styled('span')`
  ${({ theme }) => `
    max-width: ${theme.gridUnit * 25}px;
    padding-right: ${theme.gridUnit}px;
  `}
  ${ellipsisCss}
`;

const StyledTag = styled(Tag)`
  ${({ theme }) => `
    border: 1px solid ${theme.colors.grayscale.light3};
    border-radius: 2px;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;

    .anticon-close {
      vertical-align: middle;
    }
    .tooltip-wrapper {
      padding-right: ${theme.gridUnit}px;
    }
    .tag-wrapper {
      max-width: calc(100% - 17px);
      overflow: hidden;
      text-wrap: balance;
      display: inline-block;
    }
  `}
`;

const CrossFilterTag = (props: {
  filter: CrossFilterIndicator;
  orientation: FilterBarOrientation;
  removeCrossFilter: (filterId: number) => void;
}) => {
  const { filter, orientation, removeCrossFilter } = props;
  const { selectedFilters } = filter;
  const theme = useTheme();
  const [columnRef, columnIsTruncated] =
    useCSSTextTruncation<HTMLSpanElement>();
  const [valueRef, valueIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  return (
    <StyledTag
      css={css`
        ${orientation === FilterBarOrientation.VERTICAL
          ? `
            margin-top: ${theme.gridUnit * 2}px;
          `
          : `
            margin-left: ${theme.gridUnit * 2}px;
          `}
      `}
      closable
      onClose={() => removeCrossFilter(filter.emitterId)}
    >
      <span className="tag-wrapper">
        {Object.keys(selectedFilters).map(columnLabel => {
          const value = selectedFilters[columnLabel];
          return (
            <span className="tooltip-wrapper">
              <Tooltip title={columnIsTruncated ? columnLabel : null}>
                <StyledCrossFilterColumn ref={columnRef}>
                  {columnLabel}
                </StyledCrossFilterColumn>
              </Tooltip>
              <Tooltip title={valueIsTruncated ? value : null}>
                <StyledCrossFilterValue ref={valueRef}>
                  {value}
                </StyledCrossFilterValue>
              </Tooltip>
            </span>
          );
        })}
      </span>
    </StyledTag>
  );
};

export default CrossFilterTag;
