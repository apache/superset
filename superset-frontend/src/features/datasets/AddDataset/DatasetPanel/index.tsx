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
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  ErrorTypeEnum,
  getClientErrorObject,
  SupersetClient,
} from '@superset-ui/core';
import type { SupersetError } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { DatasetObject } from 'src/features/datasets/AddDataset/types';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { type DatabaseObject } from 'src/components';
import { toQueryString } from 'src/utils/urlUtils';
import DatasetPanel from './DatasetPanel';
import { ITableColumn, IDatabaseTable, isIDatabaseTable } from './types';

/**
 * Interface for the getTableMetadata API call
 */
interface TableMetadataRequest {
  /**
   * Unique id of the database
   */
  dbId: number;
  /**
   * Name of the table
   */
  tableName: string;
  /**
   * Name of the schema (optional for databases that don't support schemas)
   */
  schema?: string | null;
  /**
   * Name of the catalog (optional for databases that don't support catalogs)
   */
  catalog?: string | null;
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
  /**
   * The selected database object (used to check engine capabilities)
   */
  database?: Partial<DatabaseObject> | null;
  setHasColumns?: (hasColumns: boolean) => void;
  datasets?: DatasetObject[] | undefined;
}

const DatasetPanelWrapper = ({
  tableName,
  dbId,
  catalog,
  schema,
  database,
  setHasColumns,
  datasets,
}: IDatasetPanelWrapperProps) => {
  const [columnList, setColumnList] = useState<ITableColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SupersetError>();
  const requestIdRef = useRef(0);
  const currentRequestRef = useRef<TableMetadataRequest>();
  const supportsSchemas = database?.supports_schemas;

  const getTableMetadata = useCallback(
    async (props: TableMetadataRequest) => {
      const { dbId, tableName, catalog, schema } = props;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setLoading(true);
      setColumnList([]);
      setError(undefined);
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

        if (requestId !== requestIdRef.current) {
          return;
        }

        const table = isIDatabaseTable(response?.json)
          ? (response.json as IDatabaseTable)
          : undefined;
        if (table?.name === tableName) {
          setColumnList(table.columns);
          setHasColumns?.(table.columns.length > 0);
          setError(undefined);
        } else {
          const message = t(
            'The API response from %s does not match the IDatabaseTable interface.',
            path,
          );
          setColumnList([]);
          setHasColumns?.(false);
          setError({
            error_type: ErrorTypeEnum.GENERIC_BACKEND_ERROR,
            extra: null,
            level: 'error',
            message,
          });
          addDangerToast(message);
          logging.error(message);
        }
      } catch (caughtError) {
        const clientError = await getClientErrorObject(
          caughtError as Parameters<typeof getClientErrorObject>[0],
        );

        if (requestId === requestIdRef.current) {
          const parsedError = clientError.errors?.[0] ?? {
            error_type: ErrorTypeEnum.GENERIC_BACKEND_ERROR,
            extra: null,
            level: 'error' as const,
            message:
              clientError.error ||
              clientError.message ||
              clientError.statusText ||
              t('Unable to load columns for the selected table.'),
          };

          setColumnList([]);
          setHasColumns?.(false);
          setError(parsedError);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [setHasColumns],
  );

  const retryGetTableMetadata = useCallback(() => {
    if (currentRequestRef.current) {
      getTableMetadata(currentRequestRef.current);
    }
  }, [getTableMetadata]);

  useEffect(() => {
    const schemaRequired = supportsSchemas !== false;
    if (tableName && dbId && (schema || !schemaRequired)) {
      const request = {
        tableName,
        dbId,
        catalog,
        schema: schema || undefined,
      };
      currentRequestRef.current = request;
      getTableMetadata(request);
    } else if (currentRequestRef.current) {
      currentRequestRef.current = undefined;
      requestIdRef.current += 1;
      setColumnList([]);
      setError(undefined);
      setHasColumns?.(false);
      setLoading(false);
    }

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    tableName,
    dbId,
    catalog,
    schema,
    supportsSchemas,
    getTableMetadata,
    setHasColumns,
  ]);

  return (
    <DatasetPanel
      columnList={columnList}
      error={error}
      errorMitigationFunction={retryGetTableMetadata}
      loading={loading}
      tableName={tableName}
      datasets={datasets}
    />
  );
};

export default DatasetPanelWrapper;
