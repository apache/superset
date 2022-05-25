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
import { css, styled } from '@superset-ui/core';
import {
  CopyToClipboardButton,
  FilterInput,
  RowCount,
} from 'src/explore/components/DataTableControl';
import { applyFormattingToTabularData } from 'src/utils/common';
import { useOriginalFormattedTimeColumns } from 'src/explore/components/useOriginalFormattedTimeColumns';

export const TableControlsWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.gridUnit * 2}px;

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
  isLoading,
}: {
  data: Record<string, any>[];
  datasourceId?: string;
  onInputChange: (input: string) => void;
  columnNames: string[];
  isLoading: boolean;
}) => {
  const originalFormattedTimeColumns =
    useOriginalFormattedTimeColumns(datasourceId);
  const formattedData = useMemo(
    () => applyFormattingToTabularData(data, originalFormattedTimeColumns),
    [data, originalFormattedTimeColumns],
  );
  return (
    <TableControlsWrapper>
      <FilterInput onChangeHandler={onInputChange} />
      <div
        css={css`
          display: flex;
          align-items: center;
        `}
      >
        <RowCount data={data} loading={isLoading} />
        <CopyToClipboardButton data={formattedData} columns={columnNames} />
      </div>
    </TableControlsWrapper>
  );
};
