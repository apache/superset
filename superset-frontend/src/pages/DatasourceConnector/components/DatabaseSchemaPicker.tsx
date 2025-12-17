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
import { useCallback } from 'react';
import { styled } from '@apache-superset/core/ui';
import { DatabaseSelector } from 'src/components';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';

interface DatabaseSchemaPickerProps {
  database: DatabaseObject | null;
  catalog: string | null;
  schema: string | null;
  onDatabaseChange: (db: DatabaseObject | null) => void;
  onCatalogChange: (catalog: string | null) => void;
  onSchemaChange: (schema: string | null) => void;
  onError: (msg: string) => void;
  onRefreshDatabases?: () => void;
}

const PickerContainer = styled.div`
  ${({ theme }) => `
    width: 100%;

    & > div {
      margin-bottom: ${theme.paddingMD}px;
    }
  `}
`;

export default function DatabaseSchemaPicker({
  database,
  catalog,
  schema,
  onDatabaseChange,
  onCatalogChange,
  onSchemaChange,
  onError,
  onRefreshDatabases,
}: DatabaseSchemaPickerProps) {
  const handleDbChange = useCallback(
    (db: DatabaseObject) => {
      onDatabaseChange(db);
      // Clear catalog and schema when database changes
      onCatalogChange(null);
      onSchemaChange(null);
    },
    [onDatabaseChange, onCatalogChange, onSchemaChange],
  );

  const handleCatalogChange = useCallback(
    (cat?: string) => {
      onCatalogChange(cat ?? null);
      // Clear schema when catalog changes
      onSchemaChange(null);
    },
    [onCatalogChange, onSchemaChange],
  );

  const handleSchemaChange = useCallback(
    (sch?: string) => {
      onSchemaChange(sch ?? null);
    },
    [onSchemaChange],
  );

  return (
    <PickerContainer>
      <DatabaseSelector
        db={database}
        catalog={catalog}
        schema={schema ?? undefined}
        onDbChange={handleDbChange}
        onCatalogChange={handleCatalogChange}
        onSchemaChange={handleSchemaChange}
        handleError={onError}
        formMode
        getDbList={onRefreshDatabases}
      />
    </PickerContainer>
  );
}
