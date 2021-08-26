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
import React, { ReactNode, useState, useMemo } from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { Select } from 'src/components';
import { FormLabel } from 'src/components/Form';
import RefreshLabel from 'src/components/RefreshLabel';

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
      flex: 1;
    }

    & > div {
      margin-bottom: ${theme.gridUnit * 4}px;
    }
  `}
`;

type DatabaseValue = { label: string; value: number };

type SchemaValue = { label: string; value: string };

interface DatabaseSelectorProps {
  db?: { id: number; database_name: string; backend: string };
  formMode?: boolean;
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: any) => void;
  onSchemaChange?: (schema?: string) => void;
  onSchemasLoad?: (schemas: Array<object>) => void;
  readOnly?: boolean;
  schema?: string;
  sqlLabMode?: boolean;
  onUpdate?: ({
    dbId,
    schema,
  }: {
    dbId: number;
    schema?: string;
    tableName?: string;
  }) => void;
}

export default function DatabaseSelector({
  db,
  formMode = false,
  getDbList,
  handleError,
  isDatabaseSelectEnabled = true,
  onUpdate,
  onDbChange,
  onSchemaChange,
  onSchemasLoad,
  readOnly = false,
  schema,
  sqlLabMode = false,
}: DatabaseSelectorProps) {
  const [currentDb, setCurrentDb] = useState(
    db
      ? { label: `${db.backend}: ${db.database_name}`, value: db.id }
      : undefined,
  );
  const [currentSchema, setCurrentSchema] = useState<SchemaValue | undefined>(
    schema ? { label: schema, value: schema } : undefined,
  );
  const [refresh, setRefresh] = useState(0);

  const loadSchemas = useMemo(
    () => async (): Promise<{
      data: SchemaValue[];
      totalCount: number;
    }> => {
      if (currentDb) {
        const queryParams = rison.encode({ force: refresh > 0 });
        const endpoint = `/api/v1/database/${currentDb.value}/schemas/?q=${queryParams}`;

        // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
        return SupersetClient.get({ endpoint }).then(({ json }) => {
          const options = json.result.map((s: string) => ({
            value: s,
            label: s,
            title: s,
          }));
          if (onSchemasLoad) {
            onSchemasLoad(options);
          }
          return {
            data: options,
            totalCount: options.length,
          };
        });
      }
      return {
        data: [],
        totalCount: 0,
      };
    },
    [currentDb, refresh, onSchemasLoad],
  );

  function onSelectChange({
    db,
    schema,
  }: {
    db: DatabaseValue;
    schema?: SchemaValue;
  }) {
    setCurrentDb(db);
    setCurrentSchema(schema);
    if (onUpdate) {
      onUpdate({
        dbId: db.value,
        schema: schema?.value,
        tableName: undefined,
      });
    }
  }

  function changeDataBase(selectedValue: DatabaseValue) {
    const actualDb = selectedValue || db;
    if (onSchemaChange) {
      onSchemaChange(undefined);
    }
    if (onDbChange) {
      onDbChange(db);
    }
    onSelectChange({ db: actualDb, schema: undefined });
  }

  function changeSchema(schema: SchemaValue) {
    if (onSchemaChange) {
      onSchemaChange(schema.value);
    }
    if (currentDb) {
      onSelectChange({ db: currentDb, schema });
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

  const loadDatabases = useMemo(
    () => async (
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
          handleError(t("It seems you don't have access to any database"));
        }
        const options = result.map(
          (row: { backend: string; database_name: string; id: number }) => ({
            label: `${row.backend}: ${row.database_name}`,
            value: row.id,
          }),
        );
        return {
          data: options,
          totalCount: options.length,
        };
      });
    },
    [formMode, getDbList, handleError, sqlLabMode],
  );

  function renderDatabaseSelect() {
    return renderSelectRow(
      <Select
        ariaLabel={t('Select a database')}
        data-test="select-database"
        header={<FormLabel>{t('Database')}</FormLabel>}
        onChange={changeDataBase}
        value={currentDb}
        placeholder={t('Select a database')}
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
        ariaLabel={t('Select a schema')}
        disabled={readOnly}
        header={<FormLabel>{t('Schema')}</FormLabel>}
        name="select-schema"
        placeholder={t('Select a schema')}
        onChange={item => changeSchema(item as SchemaValue)}
        options={loadSchemas}
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
