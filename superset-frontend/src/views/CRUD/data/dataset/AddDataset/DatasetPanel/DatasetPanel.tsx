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
import { supersetTheme, t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Table, { ColumnsType, TableSize } from 'src/components/Table';
import { alphabeticalSort } from 'src/components/Table/sorters';
// @ts-ignore
import LOADING_GIF from 'src/assets/images/loading.gif';
import { ITableColumn } from './types';
import MessageContent from './MessageContent';

/**
 * Enum defining CSS position options
 */
enum EPosition {
  ABSOLUTE = 'absolute',
  RELATIVE = 'relative',
}

/**
 * Interface for StyledHeader
 */
interface StyledHeaderProps {
  /**
   * Determine the CSS positioning type
   * Vertical centering of loader, No columns screen, and select table screen
   * gets offset when the header position is relative and needs to be absolute, but table
   * needs this positioned relative to render correctly
   */
  position: EPosition;
}

const LOADER_WIDTH = 200;
const SPINNER_WIDTH = 120;
const HALF = 0.5;
const MARGIN_MULTIPLIER = 3;

const StyledHeader = styled.div<StyledHeaderProps>`
  position: ${(props: StyledHeaderProps) => props.position};
  margin: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;
  margin-top: ${({ theme }) => theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px;
  font-size: ${({ theme }) => theme.gridUnit * 6}px;
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  padding-bottom: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .anticon:first-of-type {
    margin-right: ${({ theme }) => theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px;
  }

  .anticon:nth-of-type(2) {
    margin-left: ${({ theme }) => theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px;
  }
`;

const StyledTitle = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

const LoaderContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 8}px
    ${({ theme }) => theme.gridUnit * 6}px;

  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const StyledLoader = styled.div`
  max-width: 50%;
  width: ${LOADER_WIDTH}px;

  img {
    width: ${SPINNER_WIDTH}px;
    margin-left: ${(LOADER_WIDTH - SPINNER_WIDTH) * HALF}px;
  }

  div {
    width: 100%;
    margin-top: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;
    text-align: center;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const TableContainer = styled.div`
  position: relative;
  margin: ${({ theme }) => theme.gridUnit * MARGIN_MULTIPLIER}px;
  overflow: scroll;
  height: calc(100% - ${({ theme }) => theme.gridUnit * 36}px);
`;

const StyledTable = styled(Table)`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`;

export const REFRESHING = t('Refreshing columns');
export const COLUMN_TITLE = t('Table columns');
export const ALT_LOADING = t('Loading');

const pageSizeOptions = ['5', '10', '15', '25'];

// Define the columns for Table instance
export const tableColumnDefinition: ColumnsType<ITableColumn> = [
  {
    title: 'Column Name',
    dataIndex: 'name',
    key: 'name',
    sorter: (a: ITableColumn, b: ITableColumn) =>
      alphabeticalSort('name', a, b),
  },
  {
    title: 'Datatype',
    dataIndex: 'type',
    key: 'type',
    width: '100px',
    sorter: (a: ITableColumn, b: ITableColumn) =>
      alphabeticalSort('type', a, b),
  },
];

/**
 * Props interface for DatasetPanel
 */
export interface IDatasetPanelProps {
  /**
   * Name of the database table
   */
  tableName?: string | null;
  /**
   * Array of ITableColumn instances with name and type attributes
   */
  columnList: ITableColumn[];
  /**
   * Boolean indicating if there is an error state
   */
  hasError: boolean;
  /**
   * Boolean indicating if the component is in a loading state
   */
  loading: boolean;
}

const DatasetPanel = ({
  tableName,
  columnList,
  loading,
  hasError,
}: IDatasetPanelProps) => {
  const hasColumns = columnList?.length > 0 ?? false;

  let component;
  if (loading) {
    component = (
      <LoaderContainer>
        <StyledLoader>
          <img alt={ALT_LOADING} src={LOADING_GIF} />
          <div>{REFRESHING}</div>
        </StyledLoader>
      </LoaderContainer>
    );
  } else if (tableName && hasColumns && !hasError) {
    component = (
      <>
        <StyledTitle>{COLUMN_TITLE}</StyledTitle>
        <TableContainer>
          <StyledTable
            loading={loading}
            size={TableSize.SMALL}
            columns={tableColumnDefinition}
            data={columnList}
            pageSizeOptions={pageSizeOptions}
            defaultPageSize={10}
          />
        </TableContainer>
      </>
    );
  } else {
    component = (
      <MessageContent
        hasColumns={hasColumns}
        hasError={hasError}
        tableName={tableName}
      />
    );
  }

  return (
    <>
      {tableName && (
        <StyledHeader
          position={
            !loading && hasColumns ? EPosition.RELATIVE : EPosition.ABSOLUTE
          }
          title={tableName || ''}
        >
          {tableName && (
            <Icons.Table iconColor={supersetTheme.colors.grayscale.base} />
          )}
          {tableName}
        </StyledHeader>
      )}
      {component}
    </>
  );
};

export default DatasetPanel;
