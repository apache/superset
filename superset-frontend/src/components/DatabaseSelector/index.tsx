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
import { JsonObject, styled, SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { Select } from 'src/components';
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
  allow_multi_schema_metadata_fetch: boolean;
  has_catalogs: boolean;
};

export type DatabaseObject = {
  id: number;
  database_name: string;
  backend: string;
  allow_multi_schema_metadata_fetch: boolean;
  has_catalogs: boolean;
};

type SchemaValue = { label: string; value: string };
type CatalogValue = { label: string; value: string };

export interface DatabaseSelectorProps {
  db?: DatabaseObject;
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
  catalog?: string;
  onCatalogChange?: (catalog?: string) => void;
  onCatalogLoad?: (catalog: Array<object>) => void;
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
  catalog,
  onCatalogLoad,
  onCatalogChange,
  sqlLabMode = false,
}: DatabaseSelectorProps) {
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [schemaOptions, setSchemaOptions] = useState<SchemaValue[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogValue[]>([]);
  const [currentDb, setCurrentDb] = useState<DatabaseValue | undefined>(
    db
      ? {
          label: (
            <SelectLabel backend={db.backend} databaseName={db.database_name} />
          ),
          value: db.id,
          ...db,
        }
      : undefined,
  );
  const [currentSchema, setCurrentSchema] = useState<SchemaValue | undefined>(
    schema ? { label: schema, value: schema } : undefined,
  );
  const [currentCatalog, setCurrentCatalog] = useState<
    CatalogValue | undefined
  >(catalog ? { label: catalog, value: catalog } : undefined);

  const [schemaRefresh, setSchemaRefresh] = useState(0);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  const { addSuccessToast } = useToasts();

  const getQueryParams = ({
    page,
    search,
    pageSize,
  }: {
    page: number;
    search: string;
    pageSize: number;
  }) => {
    const filters =
      formMode || !sqlLabMode
        ? { filters: [{ col: 'database_name', opr: 'ct', value: search }] }
        : {
            filters: [
              { col: 'database_name', opr: 'ct', value: search },
              {
                opr: 'eq',
                value: true,
                col: 'expose_in_sqllab',
              },
            ],
          };
    return rison.encode({
      ...filters,
      page,
      page_size: pageSize,
      order_direction: 'asc',
      order_columns: 'database_name',
    });
  };

  const getDatabasesFromResponse = ({
    json,
    search,
  }: {
    search: string;
    json: JsonObject;
  }) => {
    const { result } = json;
    if (getDbList) getDbList(result);
    if (result.length === 0) if (onEmptyResults) onEmptyResults(search);
    const options = result.map((row: DatabaseObject) => ({
      id: row.id,
      value: row.id,
      backend: row.backend,
      has_catalogs: row.has_catalogs,
      database_name: row.database_name,
      label: (
        <SelectLabel backend={row.backend} databaseName={row.database_name} />
      ),
      allow_multi_schema_metadata_fetch: row.allow_multi_schema_metadata_fetch,
    }));
    return { data: options, totalCount: options.length };
  };

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
        const queryParams = getQueryParams({ page, search, pageSize });
        const endpoint = `/api/v1/database/?q=${queryParams}`;
        return SupersetClient.get({ endpoint }).then(({ json }) =>
          getDatabasesFromResponse({ json, search }),
        );
      },
    [formMode, getDbList, sqlLabMode],
  );

  const fetchCatalogs = () => {
    setLoadingCatalogs(true);
    const queryParams = rison.encode({ force: catalogRefresh > 0 });
    const endpoint = `/api/v1/database/${currentDb?.value}/catalogs/?q=${queryParams}`;
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const options = json.result.map((s: string) => ({
          value: s,
          label: s,
          title: s,
        }));
        if (onCatalogLoad) onCatalogLoad(options);
        setCatalogOptions(options);
        setLoadingCatalogs(false);
        if (catalogRefresh > 0) addSuccessToast('List refreshed');
      })
      .catch(() => {
        setLoadingCatalogs(false);
        handleError(t('There was an error loading the catalogs'));
      });
  };

  const fetchSchemas = (currentDb: DatabaseValue) => {
    setLoadingSchemas(true);
    const queryParams = rison.encode({ force: schemaRefresh > 0 });
    const endpoint = currentDb.has_catalogs
      ? `/api/v1/database/${currentDb.value}/${currentCatalog?.value}/schemas/?q=${queryParams}`
      : `/api/v1/database/${currentDb.value}/schemas/?q=${queryParams}`;
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const options = json.result.map((s: string) => ({
          value: s,
          label: s,
          title: s,
        }));
        if (onSchemasLoad) onSchemasLoad(options);
        setSchemaOptions(options);
        setLoadingSchemas(false);
        if (schemaRefresh > 0) addSuccessToast('List refreshed');
      })
      .catch(() => {
        setLoadingSchemas(false);
        handleError(t('There was an error loading the schemas'));
      });
  };

  useEffect(() => {
    if (currentDb) {
      if (currentDb.has_catalogs) fetchCatalogs();
      else fetchSchemas(currentDb);
    }
  }, [currentDb]);

  useEffect(() => {
    if (currentDb && currentCatalog) fetchSchemas(currentDb);
  }, [currentCatalog]);

  const showSchema = (db: DatabaseObject | undefined) =>
    db?.has_catalogs ? !!currentCatalog : true;

  function changeDataBase(
    value: { label: string; value: number },
    database: DatabaseValue,
  ) {
    setCurrentDb(database);
    setCurrentCatalog(undefined);
    setCurrentSchema(undefined);
    if (onDbChange) {
      onDbChange(database);
    }
    if (onCatalogChange) {
      onCatalogChange(undefined);
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

  function changeCatalog(catalog: CatalogValue) {
    setCurrentCatalog(catalog);
    if (onCatalogChange) {
      onCatalogChange(catalog.value);
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
      <Select
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
        onClick={() => setSchemaRefresh(schemaRefresh + 1)}
        tooltipContent={t('Force refresh schema list')}
      />
    );
    return renderSelectRow(
      <Select
        ariaLabel={t('Select schema or type schema name')}
        disabled={!currentDb || readOnly}
        header={<FormLabel>{t('Schema')}</FormLabel>}
        labelInValue
        lazyLoading={false}
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

  function renderCatalogSelect() {
    const refreshIcon = !formMode && !readOnly && (
      <RefreshLabel
        onClick={() => setCatalogRefresh(catalogRefresh + 1)}
        tooltipContent={t('Force refresh catalogs list')}
      />
    );
    return renderSelectRow(
      <Select
        showSearch
        labelInValue
        name="select-catalog"
        lazyLoading={false}
        value={currentCatalog}
        options={catalogOptions}
        loading={loadingCatalogs}
        header={<FormLabel>{t('Catalog')}</FormLabel>}
        placeholder={t('Select catalog or type catalog name')}
        ariaLabel={t('Select catalog or type catalog name')}
        onChange={item => changeCatalog(item as CatalogValue)}
      />,
      refreshIcon,
    );
  }

  return (
    <DatabaseSelectorWrapper data-test="DatabaseSelector">
      {renderDatabaseSelect()}
      {db?.has_catalogs && renderCatalogSelect()}
      {showSchema(db) && renderSchemaSelect()}
    </DatabaseSelectorWrapper>
  );
}
