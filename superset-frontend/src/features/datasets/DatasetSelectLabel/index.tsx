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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { parentLabelLower } from 'src/features/semanticLayers/label';

type Database = {
  database_name: string;
};

/**
 * One row of a dataset or combined datasource listing. Semantic views report
 * ``kind: 'semantic_view'`` and carry no schema; their ``database`` names the
 * owning semantic layer.
 */
export type Dataset = {
  id: number;
  table_name: string;
  datasource_type?: string;
  kind?: string;
  schema?: string | null;
  database?: Database | null;
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

/** Shared visible text for datasource options and their accessible names. */
export const getDatasetSelectLabelParts = (
  item: Dataset,
): [string, string, string?] => {
  const databaseName = item.database?.database_name ?? t('Not defined');
  const name =
    item.table_name && isValidValue(item.table_name)
      ? item.table_name
      : databaseName;
  return item.schema && isValidValue(item.schema)
    ? [name, databaseName, item.schema]
    : [name, databaseName];
};

export const DatasetSelectLabel = (item: Dataset) => {
  const [name, databaseName, schema] = getDatasetSelectLabelParts(item);
  return (
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
              {parentLabelLower(item.kind)}: {databaseName}
            </div>
            {schema && (
              <div>
                {t('Schema')}: {schema}
              </div>
            )}
          </div>
        </TooltipContent>
      }
    >
      <StyledLabelContainer>
        <StyledLabel>{name}</StyledLabel>
        <StyledDetailWrapper>
          <StyledLabelDetail>{databaseName}</StyledLabelDetail>
          {schema && <StyledLabelDetail>&nbsp;- {schema}</StyledLabelDetail>}
        </StyledDetailWrapper>
      </StyledLabelContainer>
    </Tooltip>
  );
};
