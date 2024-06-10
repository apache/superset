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
import { useEffect, useState, useRef } from 'react';
import { SupersetClient, logging, t } from '@superset-ui/core';
import { DatasetObject } from 'src/features/datasets/AddDataset/types';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { toQueryString } from 'src/utils/urlUtils';
import DatasetPanel from './DatasetPanel';
import { ITableColumn, IDatabaseTable, isIDatabaseTable } from './types';

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
  tableName: string;
  /**
   * Name of the schema
   */
  schema: string;
}

export interface IDatasetPanelWrapperProps {
  /**
   * Name of the database table
   */
  tableName?: string | null;
  /**
   * Database ID
   */
  dbId?: number;
  /**
   * The selected catalog/schema for the database
   */
  catalog?: string | null;
  schema?: string | null;
  setHasColumns?: Function;
  datasets?: DatasetObject[] | undefined;
}

const DatasetPanelWrapper = ({
  tableName,
  dbId,
  catalog,
  schema,
  setHasColumns,
  datasets,
}: IDatasetPanelWrapperProps) => {
  const [columnList, setColumnList] = useState<ITableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const tableNameRef = useRef(tableName);

  const getTableMetadata = async (props: IColumnProps) => {
    const { dbId, tableName, schema } = props;
    setLoading(true);
    setHasColumns?.(false);
    const path = `/api/v1/database/${dbId}/table_metadata/${toQueryString({
      name: tableName,
      catalog,
      schema,
    })}`;
    try {
      const response = await SupersetClient.get({
        endpoint: path,
      });

      if (isIDatabaseTable(response?.json)) {
        const table: IDatabaseTable = response.json as IDatabaseTable;
        /**
         *  The user is able to click other table columns while the http call for last selected table column is made
         *  This check ensures we process the response that matches the last selected table name and ignore the others
         */
        if (table.name === tableNameRef.current) {
          setColumnList(table.columns);
          setHasColumns?.(table.columns.length > 0);
          setHasError(false);
        }
      } else {
        setColumnList([]);
        setHasColumns?.(false);
        setHasError(true);
        addDangerToast(
          t(
            'The API response from %s does not match the IDatabaseTable interface.',
            path,
          ),
        );
        logging.error(
          t(
            'The API response from %s does not match the IDatabaseTable interface.',
            path,
          ),
        );
      }
    } catch (error) {
      setColumnList([]);
      setHasColumns?.(false);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    tableNameRef.current = tableName;
    if (tableName && schema && dbId) {
      getTableMetadata({ tableName, dbId, schema });
    }
    // getTableMetadata is a const and should not be in dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, dbId, schema]);

  return (
    <DatasetPanel
      columnList={columnList}
      hasError={hasError}
      loading={loading}
      tableName={tableName}
      datasets={datasets}
    />
  );
};

export default DatasetPanelWrapper;
