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
import { Tooltip } from '@superset-ui/core/components';
import { styled, t } from '@superset-ui/core';

type Database = {
  database_name: string;
};

export type Dataset = {
  id: number;
  table_name: string;
  datasource_type?: string;
  schema: string;
  database: Database;
};

const TooltipContent = styled.div`
  ${({ theme }) => `
    .tooltip-header {
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
    }

    .tooltip-description {
      margin-top: ${theme.sizeUnit * 2}px;
      display: -webkit-box;
      -webkit-line-clamp: 20;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `}
`;

const StyledLabelContainer = styled.div`
  ${({ theme }) => `
    left: ${theme.sizeUnit * 3}px;
    right: ${theme.sizeUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  `}
`;

const StyledLabel = styled.span`
  ${({ theme }) => `
    left: ${theme.sizeUnit * 3}px;
    right: ${theme.sizeUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  `}
`;

const StyledDetailWrapper = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  justify-content: start;
  width: 100%;
`;

const StyledLabelDetail = styled.span`
  ${({ theme: { fontSizeSM, colorTextSecondary } }) => `
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${fontSizeSM}px;
    color: ${colorTextSecondary};
    line-height: 1.6;
  `}
`;

const isValidValue = (value: string): boolean =>
  !['null', 'none'].includes(value.toLowerCase()) && value.trim() !== '';

export const DatasetSelectLabel = (item: Dataset) => (
  <Tooltip
    mouseEnterDelay={0.2}
    placement="right"
    title={
      <TooltipContent>
        <div className="tooltip-header">
          {item.table_name && isValidValue(item.table_name)
            ? item.table_name
            : t('Not defined')}
        </div>
        <div className="tooltip-description">
          <div>
            {t('Database')}: {item.database.database_name}
          </div>
          <div>
            {t('Schema')}:{' '}
            {item.schema && isValidValue(item.schema)
              ? item.schema
              : t('Not defined')}
          </div>
        </div>
      </TooltipContent>
    }
  >
    <StyledLabelContainer>
      <StyledLabel>
        {item.table_name && isValidValue(item.table_name)
          ? item.table_name
          : item.database.database_name}
      </StyledLabel>
      <StyledDetailWrapper>
        <StyledLabelDetail>{item.database.database_name}</StyledLabelDetail>
        {item.schema && isValidValue(item.schema) && (
          <StyledLabelDetail>&nbsp;- {item.schema}</StyledLabelDetail>
        )}
      </StyledDetailWrapper>
    </StyledLabelContainer>
  </Tooltip>
);
