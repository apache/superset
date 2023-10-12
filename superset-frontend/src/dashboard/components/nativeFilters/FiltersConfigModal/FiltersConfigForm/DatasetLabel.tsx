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
import { Tooltip } from 'src/components/Tooltip';
import { styled } from '@superset-ui/core';

type Database = {
  database_name: string;
};

type Dataset = {
  id: number;
  table_name: string;
  schema: string;
  database: Database;
};

const TooltipContent = styled.div`
  ${({ theme }) => `
    .tooltip-header {
      font-size: ${theme.typography.sizes.m}px;
      font-weight: ${theme.typography.weights.bold};
    }

    .tooltip-description {
      margin-top: ${theme.gridUnit * 2}px;
      display: -webkit-box;
      -webkit-line-clamp: 20;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `}
`;

const StyledLabel = styled.span`
  ${({ theme }) => `
    left: ${theme.gridUnit * 3}px;
    right: ${theme.gridUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  `}
`;

const StyledLabelDetail = styled.span`
  ${({
    theme: {
      typography: { sizes, weights },
    },
  }) => `
    overflow: hidden;
    display: inline-block;
    text-overflow: ellipsis;
    font-size: ${sizes.s}px;
    font-weight: ${weights.light};
    max-width: 50%;
    line-height: 1.4;
  `}
`;

const StyledLabelContainer = styled.div`
  ${({ theme }) => `
    left: ${theme.gridUnit * 3}px;
    right: ${theme.gridUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  `}
`;

export const newLabel = (item: Dataset | Record<string, any>) => (
  <Tooltip
    mouseEnterDelay={1}
    placement="right"
    title={
      <TooltipContent>
        <div className="tooltip-header">{item.table_name}</div>
        <div className="tooltip-description">
          <div>Database: {item.database.database_name}</div>
          <div>
            Schema:{' '}
            {item.schema &&
            !['null', 'none'].includes(item.schema.toLowerCase())
              ? item.schema
              : 'Not defined'}
          </div>
        </div>
      </TooltipContent>
    }
  >
    <StyledLabelContainer>
      <StyledLabel>{item.table_name}</StyledLabel>
      <StyledLabelDetail>{item.database.database_name}</StyledLabelDetail>
      {item.schema && !['null', 'none'].includes(item.schema.toLowerCase()) && (
        <StyledLabelDetail>&nbsp;- {item.schema}</StyledLabelDetail>
      )}
    </StyledLabelContainer>
  </Tooltip>
);
