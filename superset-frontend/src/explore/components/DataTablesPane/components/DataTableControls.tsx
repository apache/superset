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
import { styled, css } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { useMemo } from 'react';
import { zip } from 'lodash';
import { Select } from 'antd';
import {
  CopyToClipboardButton,
  FilterInput,
} from 'src/explore/components/DataTableControl';
import { applyFormattingToTabularData } from 'src/utils/common';
import { getTimeColumns } from 'src/explore/components/DataTableControl/utils';
import RowCountLabel from 'src/components/RowCountLabel';
import { TableControlsProps } from '../types';

export const ROW_LIMIT_OPTIONS = [
  { value: 100, label: '100 rows' },
  { value: 500, label: '500 rows' },
  { value: 1000, label: '1k rows' },
  { value: 5000, label: '5k rows' },
  { value: 10000, label: '10k rows' },
];

export const TableControlsWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    padding-top: ${theme.sizeUnit * 2}px;
    padding-bottom: ${theme.sizeUnit * 2}px;
    justify-content: space-between;

    span {
      flex-shrink: 0;
    }
  `}
`;

export const TableControls = ({
  data,
  datasourceId,
  onInputChange,
  columnNames,
  columnTypes,
  rowcount,
  isLoading,
  canDownload,
  rowLimit,
  rowLimitOptions,
  onRowLimitChange,
}: TableControlsProps) => {
  const originalTimeColumns = getTimeColumns(datasourceId);
  const formattedTimeColumns = zip<string, GenericDataType>(
    columnNames,
    columnTypes,
  )
    .filter(
      ([name, type]) =>
        type === GenericDataType.Temporal &&
        name &&
        !originalTimeColumns.includes(name),
    )
    .map(([colname]) => colname)
    .filter((x): x is string => x !== undefined);
  const formattedData = useMemo(
    () => applyFormattingToTabularData(data, formattedTimeColumns),
    [data, formattedTimeColumns],
  );
  return (
    <TableControlsWrapper>
      <FilterInput onChangeHandler={onInputChange} shouldFocus />
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 8px;
        `}
      >
        {onRowLimitChange && (
          <Select
            value={rowLimit}
            onChange={onRowLimitChange}
            options={rowLimitOptions}
            size="small"
            css={css`
              min-width: 110px;
            `}
          />
        )}
        {(!onRowLimitChange || rowcount < (rowLimit ?? Infinity)) && (
          <RowCountLabel rowcount={rowcount} loading={isLoading} />
        )}
        {canDownload && (
          <CopyToClipboardButton data={formattedData} columns={columnNames} />
        )}
      </div>
    </TableControlsWrapper>
  );
};
