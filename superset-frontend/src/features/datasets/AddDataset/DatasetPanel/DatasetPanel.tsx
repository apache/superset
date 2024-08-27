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
import { t, styled, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Alert from 'src/components/Alert';
import Table, { ColumnsType, TableSize } from 'src/components/Table';
import { alphabeticalSort } from 'src/components/Table/sorters';
// @ts-ignore
import LOADING_GIF from 'src/assets/images/loading.gif';
import { DatasetObject } from 'src/features/datasets/AddDataset/types';
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
  ${({ theme, position }) => `
  position: ${position};
  margin: ${theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px
    ${theme.gridUnit * MARGIN_MULTIPLIER}px
    ${theme.gridUnit * MARGIN_MULTIPLIER}px
    ${theme.gridUnit * (MARGIN_MULTIPLIER + 3)}px;
  font-size: ${theme.gridUnit * 6}px;
  font-weight: ${theme.typography.weights.medium};
  padding-bottom: ${theme.gridUnit * MARGIN_MULTIPLIER}px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .anticon:first-of-type {
    margin-right: ${theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px;
  }

  .anticon:nth-of-type(2) {
    margin-left: ${theme.gridUnit * (MARGIN_MULTIPLIER + 1)}px;
  `}
`;

const StyledTitle = styled.div`
  ${({ theme }) => `
  margin-left: ${theme.gridUnit * (MARGIN_MULTIPLIER + 3)}px;
  margin-bottom: ${theme.gridUnit * MARGIN_MULTIPLIER}px;
  font-weight: ${theme.typography.weights.bold};
  `}
`;

const LoaderContainer = styled.div`
  ${({ theme }) => `
  padding: ${theme.gridUnit * 8}px
    ${theme.gridUnit * 6}px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  `}
`;

const StyledLoader = styled.div`
  ${({ theme }) => `
  max-width: 50%;
  width: ${LOADER_WIDTH}px;

  img {
    width: ${SPINNER_WIDTH}px;
    margin-left: ${(LOADER_WIDTH - SPINNER_WIDTH) * HALF}px;
  }

  div {
    width: 100%;
    margin-top: ${theme.gridUnit * MARGIN_MULTIPLIER}px;
    text-align: center;
    font-weight: ${theme.typography.weights.normal};
    font-size: ${theme.typography.sizes.l}px;
    color: ${theme.colors.grayscale.light1};
  }
  `}
`;

const TableContainerWithBanner = styled.div`
  ${({ theme }) => `
  position: relative;
  margin: ${theme.gridUnit * MARGIN_MULTIPLIER}px;
  margin-left: ${theme.gridUnit * (MARGIN_MULTIPLIER + 3)}px;
  height: calc(100% - ${theme.gridUnit * 60}px);
  overflow: auto;
  `}
`;

const TableContainerWithoutBanner = styled.div`
  ${({ theme }) => `
  position: relative;
  margin: ${theme.gridUnit * MARGIN_MULTIPLIER}px;
  margin-left: ${theme.gridUnit * (MARGIN_MULTIPLIER + 3)}px;
  height: calc(100% - ${theme.gridUnit * 30}px);
  overflow: auto;
  `}
`;

const TableScrollContainer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`;

const StyledAlert = styled(Alert)`
  ${({ theme }) => `
  border: 1px solid ${theme.colors.info.base};
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 6}px ${theme.gridUnit * 6}px
    ${theme.gridUnit * 8}px;
  .view-dataset-button {
    position: absolute;
    top: ${theme.gridUnit * 4}px;
    right: ${theme.gridUnit * 4}px;
    font-weight: ${theme.typography.weights.normal};

    &:hover {
      color: ${theme.colors.secondary.dark3};
      text-decoration: underline;
    }
  }
  `}
`;

export const REFRESHING = t('Refreshing columns');
export const COLUMN_TITLE = t('Table columns');
export const ALT_LOADING = t('Loading');

const pageSizeOptions = ['5', '10', '15', '25'];
const DEFAULT_PAGE_SIZE = 25;

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
  datasets?: DatasetObject[] | undefined;
}

const EXISTING_DATASET_DESCRIPTION = t(
  'This table already has a dataset associated with it. You can only associate one dataset with a table.\n',
);
const VIEW_DATASET = t('View Dataset');

const renderExistingDatasetAlert = (dataset?: DatasetObject) => (
  <StyledAlert
    closable={false}
    type="info"
    showIcon
    message={t('This table already has a dataset')}
    description={
      <>
        {EXISTING_DATASET_DESCRIPTION}
        <span
          role="button"
          onClick={() => {
            window.open(
              dataset?.explore_url,
              '_blank',
              'noreferrer noopener popup=false',
            );
          }}
          tabIndex={0}
          className="view-dataset-button"
        >
          {VIEW_DATASET}
        </span>
      </>
    }
  />
);

const DatasetPanel = ({
  tableName,
  columnList,
  loading,
  hasError,
  datasets,
}: IDatasetPanelProps) => {
  const theme = useTheme();
  const hasColumns = columnList?.length > 0 ?? false;
  const datasetNames = datasets?.map(dataset => dataset.table_name);
  const tableWithDataset = datasets?.find(
    dataset => dataset.table_name === tableName,
  );

  let component;
  let loader;
  if (loading) {
    loader = (
      <LoaderContainer>
        <StyledLoader>
          <img alt={ALT_LOADING} src={LOADING_GIF} />
          <div>{REFRESHING}</div>
        </StyledLoader>
      </LoaderContainer>
    );
  }
  if (!loading) {
    if (!loading && tableName && hasColumns && !hasError) {
      component = (
        <>
          <StyledTitle>{COLUMN_TITLE}</StyledTitle>
          {tableWithDataset ? (
            <TableContainerWithBanner>
              <TableScrollContainer>
                <Table
                  loading={loading}
                  size={TableSize.Small}
                  columns={tableColumnDefinition}
                  data={columnList}
                  pageSizeOptions={pageSizeOptions}
                  defaultPageSize={DEFAULT_PAGE_SIZE}
                />
              </TableScrollContainer>
            </TableContainerWithBanner>
          ) : (
            <TableContainerWithoutBanner>
              <TableScrollContainer>
                <Table
                  loading={loading}
                  size={TableSize.Small}
                  columns={tableColumnDefinition}
                  data={columnList}
                  pageSizeOptions={pageSizeOptions}
                  defaultPageSize={DEFAULT_PAGE_SIZE}
                />
              </TableScrollContainer>
            </TableContainerWithoutBanner>
          )}
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
  }

  return (
    <>
      {tableName && (
        <>
          {datasetNames?.includes(tableName) &&
            renderExistingDatasetAlert(tableWithDataset)}
          <StyledHeader
            position={
              !loading && hasColumns ? EPosition.RELATIVE : EPosition.ABSOLUTE
            }
            title={tableName || ''}
          >
            {tableName && (
              <Icons.Table iconColor={theme.colors.grayscale.base} />
            )}
            {tableName}
          </StyledHeader>
        </>
      )}
      {component}
      {loader}
    </>
  );
};

export default DatasetPanel;
