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
import { useFetchSchemas } from './fetchSchemas';
import { useOnSelectChange } from './onSelectChange';
import { useDbMutator } from './dbMutator';
import { useChangeDataBase } from './changeDataBase';
import { useChangeSchema } from './changeSchema';
import { SchemaSelect } from './SchemaSelect';
import { DatabaseSelect } from './DatabaseSelect';

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
    margin-left: ${({ theme }) => theme.gridUnit}px;
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
  formMode,
  readOnly,
  schema,
  sqlLabMode,
  isDatabaseSelectEnabled = true,
  getDbList,
  getTableList,
  handleError,
  onChange,
  onDbChange,
  onSchemaChange,
  onSchemasLoad,
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

  return (
    <DatabaseSelectorWrapper>
      {formMode && <FieldTitle>{t('datasource')}</FieldTitle>}
      <DatabaseSelect
        disableFilters={formMode || !sqlLabMode}
        isDisabled={!isDatabaseSelectEnabled || readOnly}
        currentDbId={currentDbId}
        handleError={handleError}
        mutator={dbMutator}
        onChange={db => changeDataBase.current(db)}
      />
      {formMode && <FieldTitle>{t('schema')}</FieldTitle>}
      <SchemaSelect
        schemaOptions={schemaOptions}
        currentSchema={currentSchema}
        hasRefresh={!formMode && !readOnly}
        refresh={() => changeDataBase.current({ id: dbId }, true)}
        onChange={selectedSchema =>
          changeSchema.current({ currentDbId, selectedSchema })
        }
        loading={schemaLoading}
        readOnly={readOnly}
      />
    </DatabaseSelectorWrapper>
  );
}
