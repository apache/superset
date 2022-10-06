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
import React, { ReactNode, useState, useMemo, useEffect } from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { AsyncSelect, Select } from 'src/components';
import Label from 'src/components/Label';
import { FormLabel } from 'src/components/Form';
import RefreshLabel from 'src/components/RefreshLabel';
import { useToasts } from 'src/components/MessageToasts/withToasts';

const DatabaseSelectorWrapper = styled.div`
  ${({ theme }) => `
    .refresh {
      display: flex;
      align-items: center;
      width: 30px;
      margin-left: ${theme.gridUnit}px;
      margin-top: ${theme.gridUnit * 5}px;
    }

    .section {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    .select {
      width: calc(100% - 30px - ${theme.gridUnit}px);
      flex: 1;
    }

    & > div {
      margin-bottom: ${theme.gridUnit * 4}px;
    }
  `}
`;

const LabelStyle = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: ${({ theme }) => theme.gridUnit - 2}px;

  .backend {
    overflow: visible;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

type DatabaseValue = {
  label: React.ReactNode;
  value: number;
  id: number;
  database_name: string;
  backend: string;
};

export type DatabaseObject = {
  id: number;
  database_name: string;
  backend: string;
};

type SchemaValue = { label: string; value: string };

export interface DatabaseSelectorProps {
  db?: DatabaseObject | null;
  emptyState?: ReactNode;
  formMode?: boolean;
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: DatabaseObject) => void;
  onEmptyResults?: (searchText?: string) => void;
  onSchemaChange?: (schema?: string) => void;
  onSchemasLoad?: (schemas: Array<object>) => void;
  readOnly?: boolean;
  schema?: string;
  sqlLabMode?: boolean;
}

const SelectLabel = ({
  backend,
  databaseName,
}: {
  backend: string;
  databaseName: string;
}) => (
  <LabelStyle>
    <Label className="backend">{backend}</Label>
    <span className="name" title={databaseName}>
      {databaseName}
    </span>
  </LabelStyle>
);

export default function DatabaseSelector({
  db,
  formMode = false,
  emptyState,
  getDbList,
  handleError,
  isDatabaseSelectEnabled = true,
  onDbChange,
  onEmptyResults,
  onSchemaChange,
  onSchemasLoad,
  readOnly = false,
  schema,
  sqlLabMode = false,
}: DatabaseSelectorProps) {
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [schemaOptions, setSchemaOptions] = useState<SchemaValue[]>([]);
  const [currentDb, setCurrentDb] = useState<DatabaseValue | undefined>();
  const [currentSchema, setCurrentSchema] = useState<SchemaValue | undefined>(
    schema ? { label: schema, value: schema } : undefined,
  );
  const [refresh, setRefresh] = useState(0);
  const { addSuccessToast } = useToasts();

  const loadDatabases = useMemo(
    () =>
      async (
        search: string,
        page: number,
        pageSize: number,
      ): Promise<{
        data: DatabaseValue[];
        totalCount: number;
      }> => {
        const queryParams = rison.encode({
          order_columns: 'database_name',
          order_direction: 'asc',
          page,
          page_size: pageSize,
          ...(formMode || !sqlLabMode
            ? { filters: [{ col: 'database_name', opr: 'ct', value: search }] }
            : {
                filters: [
                  { col: 'database_name', opr: 'ct', value: search },
                  {
                    col: 'expose_in_sqllab',
                    opr: 'eq',
                    value: true,
                  },
                ],
              }),
        });
        const endpoint = `/api/v1/database/?q=${queryParams}`;
        return SupersetClient.get({ endpoint }).then(({ json }) => {
          const { result } = json;
          if (getDbList) {
            getDbList(result);
          }
          if (result.length === 0) {
            if (onEmptyResults) onEmptyResults(search);
          }
          const options = result.map((row: DatabaseObject) => ({
            label: (
              <SelectLabel
                backend={row.backend}
                databaseName={row.database_name}
              />
            ),
            value: row.id,
            id: row.id,
            database_name: row.database_name,
            backend: row.backend,
          }));

          return {
            data: options,
            totalCount: options.length,
          };
        });
      },
    [formMode, getDbList, sqlLabMode],
  );

  useEffect(() => {
    setCurrentDb(current =>
      current?.id !== db?.id
        ? db
          ? {
              label: (
                <SelectLabel
                  backend={db.backend}
                  databaseName={db.database_name}
                />
              ),
              value: db.id,
              ...db,
            }
          : undefined
        : current,
    );
  }, [db]);

  useEffect(() => {
    if (currentDb) {
      setLoadingSchemas(true);
      const queryParams = rison.encode({ force: refresh > 0 });
      const endpoint = `/api/v1/database/${currentDb.value}/schemas/?q=${queryParams}`;

      // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
      SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const options = json.result.map((s: string) => ({
            value: s,
            label: s,
            title: s,
          }));
          if (onSchemasLoad) {
            onSchemasLoad(options);
          }
          setSchemaOptions(options);
          setLoadingSchemas(false);
          if (refresh > 0) addSuccessToast('List refreshed');
        })
        .catch(() => {
          setLoadingSchemas(false);
          handleError(t('There was an error loading the schemas'));
        });
    }
  }, [currentDb, onSchemasLoad, refresh]);

  function changeDataBase(
    value: { label: string; value: number },
    database: DatabaseValue,
  ) {
    setCurrentDb(database);
    setCurrentSchema(undefined);
    if (onDbChange) {
      onDbChange(database);
    }
    if (onSchemaChange) {
      onSchemaChange(undefined);
    }
  }

  function changeSchema(schema: SchemaValue) {
    setCurrentSchema(schema);
    if (onSchemaChange) {
      onSchemaChange(schema.value);
    }
  }

  function renderSelectRow(select: ReactNode, refreshBtn: ReactNode) {
    return (
      <div className="section">
        <span className="select">{select}</span>
        <span className="refresh">{refreshBtn}</span>
      </div>
    );
  }

  function renderDatabaseSelect() {
    return renderSelectRow(
      <AsyncSelect
        ariaLabel={t('Select database or type database name')}
        optionFilterProps={['database_name', 'value']}
        data-test="select-database"
        header={<FormLabel>{t('Database')}</FormLabel>}
        lazyLoading={false}
        notFoundContent={emptyState}
        onChange={changeDataBase}
        value={currentDb}
        placeholder={t('Select database or type database name')}
        disabled={!isDatabaseSelectEnabled || readOnly}
        options={loadDatabases}
      />,
      null,
    );
  }

  function renderSchemaSelect() {
    const refreshIcon = !formMode && !readOnly && (
      <RefreshLabel
        onClick={() => setRefresh(refresh + 1)}
        tooltipContent={t('Force refresh schema list')}
      />
    );
    return renderSelectRow(
      <Select
        ariaLabel={t('Select schema or type schema name')}
        disabled={!currentDb || readOnly}
        header={<FormLabel>{t('Schema')}</FormLabel>}
        labelInValue
        loading={loadingSchemas}
        name="select-schema"
        placeholder={t('Select schema or type schema name')}
        onChange={item => changeSchema(item as SchemaValue)}
        options={schemaOptions}
        showSearch
        value={currentSchema}
      />,
      refreshIcon,
    );
  }

  return (
    <DatabaseSelectorWrapper data-test="DatabaseSelector">
      {renderDatabaseSelect()}
      {renderSchemaSelect()}
    </DatabaseSelectorWrapper>
  );
}
