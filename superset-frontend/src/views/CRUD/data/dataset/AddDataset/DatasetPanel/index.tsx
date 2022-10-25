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
import React, { useEffect, useState, useRef } from 'react';
import { supersetTheme, t, styled, SupersetClient } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { EmptyStateBig } from 'src/components/EmptyState';
import Table, { ColumnsType, TableSize } from 'src/components/Table';
import { alphabeticalSort } from 'src/components/Table/sorters';

interface IDatasetPanelProps {
  /**
   * Name of the database table
   */
  tableName?: string | null;
  /**
   * Database ID
   */
  dbId?: number;
  /**
   * The selected schema for the database
   */
  schema?: string | null;
}

const VERTICAL_OFFSET = 150;
const StyledEmptyStateBig = styled(EmptyStateBig)`
  margin-top: calc(50% - ${VERTICAL_OFFSET}px);

  p {
    width: ${({ theme }) => theme.gridUnit * 115}px;
  }
`;

const StyledDatasetPanel = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 8}px
    ${({ theme }) => theme.gridUnit * 6}px;

  .table-name {
    font-size: ${({ theme }) => theme.gridUnit * 6}px;
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    padding-bottom: ${({ theme }) => theme.gridUnit * 20}px;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .anticon:first-of-type {
      margin-right: ${({ theme }) => theme.gridUnit * 4}px;
    }

    .anticon:nth-of-type(2) {
      margin-left: ${({ theme }) => theme.gridUnit * 4}px;
    }
  }
`;

const StyledTitle = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const LOADER_WIDTH = 200;
const SPINNER_WIDTH = 120;
const HALF = 0.5;
const StyledLoader = styled.div`
  margin-top: calc(50% - ${VERTICAL_OFFSET}px);
  margin-left: calc(50% - ${LOADER_WIDTH * HALF}px);
  width: 200px;

  img {
    width: ${SPINNER_WIDTH}px;
    margin-left: ${(LOADER_WIDTH - SPINNER_WIDTH) * HALF}px;
  }

  div {
    width: 100%;
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
    text-align: center;
    font-weight: 400;
    font-size: 16px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const renderEmptyDescription = () => (
  <>
    {t(
      'Datasets can be created from database tables or SQL queries. Select a database table to the left or ',
    )}
    <span
      role="button"
      onClick={() => {
        window.location.href = `/superset/sqllab`;
      }}
      tabIndex={0}
    >
      {t('create dataset from SQL query')}
    </span>
    {t(' to open SQL Lab. From there you can save the query as a dataset.')}
  </>
);
const SELECT_TABLE_TITLE = t('Select dataset source');
const NO_COLUMNS_TITLE = t('No table columns');
const NO_COLUMNS_DESCRIPTION = t(
  'This database table does not contain any data. Please select a different table.',
);

const ERROR_TITLE = t('An Error Occurred');
const ERROR_DESCRIPTION = t(
  'Unable to load columns for table. Please select a different table.',
);

const pageSizeOptions = ['5', '10', '15', '25'];

/**
 * Interface for table columns dataset
 */
interface IColumnData {
  /**
   * Name of the column
   */
  name: string;
  /**
   * Datatype of the column
   */
  type: string;
}

/**
 * Interface for the getTableMetadata API call
 */
interface IColumnProps {
  /**
   * Unique id of the database
   */
  dbId: number;
  /**
   * Name of the table
   */
  table: string;
  /**
   * Name of the schema
   */
  schema: string;
}

const DatasetPanel = ({ tableName, dbId, schema }: IDatasetPanelProps) => {
  const [columnList, setColumnList] = useState<IColumnData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const tableNameRef = useRef(tableName);

  // Define the columns for Table instance
  const tableColumns: ColumnsType<IColumnData> = [
    {
      title: 'Column Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: IColumnData, b: IColumnData) =>
        alphabeticalSort('name', a, b),
    },
    {
      title: 'Datatype',
      dataIndex: 'type',
      key: 'type',
      width: '100px',
      sorter: (a: IColumnData, b: IColumnData) =>
        alphabeticalSort('type', a, b),
    },
  ];

  const getTableMetadata = async (props: IColumnProps) => {
    const { dbId, table, schema } = props;
    setLoading(true);
    const path = `/api/v1/database/${dbId}/table/${table}/${schema}/`;
    try {
      const response = await SupersetClient.get({
        endpoint: path,
      });

      const {
        json: { name, columns },
      } = response;

      if (name === tableNameRef.current) {
        setColumnList(columns);
        setHasError(false);
      }
    } catch (error) {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    tableNameRef.current = tableName;
    if (tableName && schema && dbId) {
      getTableMetadata({ table: tableName, dbId, schema });
    }
  }, [tableName, dbId, schema]);

  const hasColumns = columnList?.length > 0;

  let currentImage: string | undefined = 'empty-dataset.svg';
  let currentTitle = SELECT_TABLE_TITLE;
  let currentDescription = renderEmptyDescription();
  if (hasError) {
    currentTitle = ERROR_TITLE;
    currentDescription = <>{ERROR_DESCRIPTION}</>;
    currentImage = undefined;
  } else if (tableName && !hasColumns) {
    currentImage = 'no-columns.svg';
    currentTitle = NO_COLUMNS_TITLE;
    currentDescription = <>{NO_COLUMNS_DESCRIPTION}</>;
  }

  let component;
  if (loading) {
    component = (
      <StyledLoader>
        <img alt="Loading" src="/static/assets/images/loading.gif" />
        <div>Refreshing columns</div>
      </StyledLoader>
    );
  } else if (tableName && hasColumns && !hasError) {
    component = (
      <>
        <StyledTitle>{t('Table columns')}</StyledTitle>
        <Table
          loading={loading}
          size={TableSize.SMALL}
          columns={tableColumns}
          data={columnList}
          pageSizeOptions={pageSizeOptions}
          defaultPageSize={10}
        />
      </>
    );
  } else {
    component = (
      <StyledEmptyStateBig
        image={currentImage}
        title={currentTitle}
        description={currentDescription}
      />
    );
  }

  return (
    <StyledDatasetPanel>
      <div className="table-name" title={tableName || ''}>
        {tableName && (
          <Icons.Table iconColor={supersetTheme.colors.grayscale.base} />
        )}
        {tableName}
      </div>
      {component}
    </StyledDatasetPanel>
  );
};

export default DatasetPanel;
