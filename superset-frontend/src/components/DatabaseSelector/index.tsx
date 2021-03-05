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
import React, { useEffect, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import rison from 'rison';
import { Select } from 'src/components/Select';
import SupersetAsyncSelect from '../AsyncSelect';
import RefreshLabel from '../RefreshLabel';
import { useFetchSchemas } from './fetchSchemas';
import { useOnSelectChange } from './onSelectChange';
import { useDbMutator } from './dbMutator';
import { useChangeDataBase } from './changeDataBase';
import { useChangeSchema } from './changeSchema';
import { DatabaseOption } from './DatabaseOption';
import { SelectRow } from './SelectRow';

const FieldTitle = styled.p`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin: 20px 0 10px 0;
  text-transform: uppercase;
`;

const DatabaseSelectorWrapper = styled.div`
  .fa-refresh {
    padding-left: 9px;
  }

  .refresh-col {
    display: flex;
    align-items: center;
    width: 30px;
  }

  .section {
    padding-bottom: 5px;
    display: flex;
    flex-direction: row;
  }

  .select {
    flex-grow: 1;
  }
`;

interface DatabaseSelectorProps {
  dbId: number;
  formMode?: boolean;
  getDbList?: (arg0: any) => {};
  getTableList?: (dbId: number, schema: string, force: boolean) => {};
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: any) => void;
  onSchemaChange?: (arg0?: any) => {};
  onSchemasLoad?: (schemas: Array<object>) => void;
  readOnly?: boolean;
  schema?: string;
  sqlLabMode?: boolean;
  onChange?: ({
    dbId,
    schema,
  }: {
    dbId: number;
    schema?: string;
    tableName?: string;
  }) => void;
}

export default function DatabaseSelector({
  dbId,
  formMode = false,
  getDbList,
  getTableList,
  handleError,
  isDatabaseSelectEnabled = true,
  onChange,
  onDbChange,
  onSchemaChange,
  onSchemasLoad,
  readOnly = false,
  schema,
  sqlLabMode = false,
}: DatabaseSelectorProps) {
  const [currentDbId, setCurrentDbId] = useState(dbId);
  const [currentSchema, setCurrentSchema] = useState<string | null | undefined>(
    schema,
  );
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaOptions, setSchemaOptions] = useState<any[]>([]);

  const fetchSchemas = useFetchSchemas({
    setSchemaOptions,
    onSchemasLoad,
    setSchemaLoading,
    handleError,
  });

  const onSelectChange = useOnSelectChange({
    setCurrentDbId,
    setCurrentSchema,
    onChange,
  });

  const dbMutator = useDbMutator({ getDbList, handleError });

  const changeDataBase = useChangeDataBase({
    fetchSchemas,
    onSelectChange,
    setSchemaOptions,
    onDbChange,
    onSchemaChange,
  });

  const changeSchema = useChangeSchema({
    onSelectChange,
    onSchemaChange,
    setCurrentSchema,
    getTableList,
  });

  useEffect(() => {
    if (currentDbId) {
      fetchSchemas.current({ databaseId: currentDbId });
    }
  }, [currentDbId, fetchSchemas]);

  function renderDatabaseSelect() {
    const queryParams = rison.encode({
      order_columns: 'database_name',
      order_direction: 'asc',
      page: 0,
      page_size: -1,
      ...(formMode || !sqlLabMode
        ? {}
        : {
            filters: [
              {
                col: 'expose_in_sqllab',
                opr: 'eq',
                value: true,
              },
            ],
          }),
    });

    const select = (
      <SupersetAsyncSelect
        data-test="select-database"
        dataEndpoint={`/api/v1/database/?q=${queryParams}`}
        onChange={(db: any) => changeDataBase.current(db)}
        onAsyncError={() =>
          handleError(t('Error while fetching database list'))
        }
        clearable={false}
        value={currentDbId}
        valueKey="id"
        valueRenderer={(db: any) => (
          <div>
            <span className="text-muted m-r-5">{t('Database:')}</span>
            <DatabaseOption
              backend={db.backend}
              database_name={db.database_name}
            />
          </div>
        )}
        optionRenderer={(db: any) => (
          <DatabaseOption
            backend={db.backend}
            database_name={db.database_name}
          />
        )}
        mutator={dbMutator.current}
        placeholder={t('Select a database')}
        autoSelect
        isDisabled={!isDatabaseSelectEnabled || readOnly}
      />
    );
    return <SelectRow select={select} />;
  }

  function renderSchemaSelect() {
    const value = schemaOptions.filter(({ value }) => currentSchema === value);
    const refresh =
      !formMode && !readOnly ? (
        <RefreshLabel
          onClick={() => changeDataBase.current({ id: dbId }, true)}
          tooltipContent={t('Force refresh schema list')}
        />
      ) : undefined;

    const select = (
      <Select
        name="select-schema"
        placeholder={t('Select a schema (%s)', schemaOptions.length)}
        options={schemaOptions}
        value={value}
        valueRenderer={o => (
          <div>
            <span className="text-muted">{t('Schema:')}</span> {o.label}
          </div>
        )}
        isLoading={schemaLoading}
        autosize={false}
        onChange={selectedSchema => {
          /**
           * Attention: The type defined in the <Select> component is incorrect.
           * The value of selectedSchema corresponds to another interface: { value: string; label: string; title: string }
           *
           * @ts-ignore is here to make it easier to find this error in the future
           */
          // @ts-ignore
          changeSchema.current({ currentDbId, selectedSchema });
        }}
        isDisabled={readOnly}
      />
    );

    return <SelectRow select={select} refreshBtn={refresh} />;
  }

  return (
    <DatabaseSelectorWrapper>
      {formMode && <FieldTitle>{t('datasource')}</FieldTitle>}
      {renderDatabaseSelect()}
      {formMode && <FieldTitle>{t('schema')}</FieldTitle>}
      {renderSchemaSelect()}
    </DatabaseSelectorWrapper>
  );
}
