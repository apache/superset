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
import {
  ReactNode,
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import type { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import rison from 'rison';
import { AsyncSelect, Select } from 'src/components';
import Label from 'src/components/Label';
import { FormLabel } from 'src/components/Form';
import RefreshLabel from 'src/components/RefreshLabel';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  useCatalogs,
  CatalogOption,
  useSchemas,
  SchemaOption,
} from 'src/hooks/apiResources';

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
  label: ReactNode;
  value: number;
  id: number;
  database_name: string;
  backend?: string;
};

export type DatabaseObject = {
  id: number;
  database_name: string;
  backend?: string;
  allow_multi_catalog?: boolean;
};

export interface DatabaseSelectorProps {
  db?: DatabaseObject | null;
  emptyState?: ReactNode;
  formMode?: boolean;
  getDbList?: (arg0: any) => void;
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: DatabaseObject) => void;
  onEmptyResults?: (searchText?: string) => void;
  onCatalogChange?: (catalog?: string) => void;
  catalog?: string | null;
  onSchemaChange?: (schema?: string) => void;
  schema?: string;
  readOnly?: boolean;
  sqlLabMode?: boolean;
}

const SelectLabel = ({
  backend,
  databaseName,
}: {
  backend?: string;
  databaseName: string;
}) => (
  <LabelStyle>
    <Label className="backend">{backend || ''}</Label>
    <span className="name" title={databaseName}>
      {databaseName}
    </span>
  </LabelStyle>
);

const EMPTY_CATALOG_OPTIONS: CatalogOption[] = [];
const EMPTY_SCHEMA_OPTIONS: SchemaOption[] = [];

interface AntdLabeledValueWithOrder extends AntdLabeledValue {
  order: number;
}

export default function DatabaseSelector({
  db,
  formMode = false,
  emptyState,
  getDbList,
  handleError,
  isDatabaseSelectEnabled = true,
  onDbChange,
  onEmptyResults,
  onCatalogChange,
  catalog,
  onSchemaChange,
  schema,
  readOnly = false,
  sqlLabMode = false,
}: DatabaseSelectorProps) {
  const showCatalogSelector = !!db?.allow_multi_catalog;
  const [currentDb, setCurrentDb] = useState<DatabaseValue | undefined>();
  const [currentCatalog, setCurrentCatalog] = useState<
    CatalogOption | null | undefined
  >(catalog ? { label: catalog, value: catalog, title: catalog } : undefined);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [currentSchema, setCurrentSchema] = useState<SchemaOption | undefined>(
    schema ? { label: schema, value: schema, title: schema } : undefined,
  );
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const { addSuccessToast } = useToasts();
  const sortComparator = useCallback(
    (itemA: AntdLabeledValueWithOrder, itemB: AntdLabeledValueWithOrder) =>
      itemA.order - itemB.order,
    [],
  );

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
          order_column: 'database_name',
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
          const { result, count } = json;
          if (getDbList) {
            getDbList(result);
          }
          if (result.length === 0) {
            if (onEmptyResults) onEmptyResults(search);
          }

          const options = result.map((row: DatabaseObject, order: number) => ({
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
            allow_multi_catalog: row.allow_multi_catalog,
            order,
          }));

          return {
            data: options,
            totalCount: count ?? options.length,
          };
        });
      },
    [formMode, getDbList, sqlLabMode, onEmptyResults],
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

  function changeSchema(schema: SchemaOption | undefined) {
    setCurrentSchema(schema);
    if (onSchemaChange && schema?.value !== schemaRef.current) {
      onSchemaChange(schema?.value);
    }
  }

  const {
    currentData: schemaData,
    isFetching: loadingSchemas,
    refetch: refetchSchemas,
  } = useSchemas({
    dbId: currentDb?.value,
    catalog: currentCatalog?.value,
    onSuccess: (schemas, isFetched) => {
      if (schemas.length === 1) {
        changeSchema(schemas[0]);
      } else if (
        !schemas.find(schemaOption => schemaRef.current === schemaOption.value)
      ) {
        changeSchema(undefined);
      }

      if (isFetched) {
        addSuccessToast('List refreshed');
      }
    },
    onError: () => handleError(t('There was an error loading the schemas')),
  });

  const schemaOptions = schemaData || EMPTY_SCHEMA_OPTIONS;

  function changeCatalog(catalog: CatalogOption | null | undefined) {
    setCurrentCatalog(catalog);
    setCurrentSchema(undefined);
    if (onCatalogChange && catalog?.value !== catalogRef.current) {
      onCatalogChange(catalog?.value);
    }
  }

  const {
    data: catalogData,
    isFetching: loadingCatalogs,
    refetch: refetchCatalogs,
  } = useCatalogs({
    dbId: showCatalogSelector ? currentDb?.value : undefined,
    onSuccess: (catalogs, isFetched) => {
      if (!showCatalogSelector) {
        changeCatalog(null);
      } else if (catalogs.length === 1) {
        changeCatalog(catalogs[0]);
      } else if (
        !catalogs.find(
          catalogOption => catalogRef.current === catalogOption.value,
        )
      ) {
        changeCatalog(undefined);
      }

      if (showCatalogSelector && isFetched) {
        addSuccessToast('List refreshed');
      }
    },
    onError: () => {
      if (showCatalogSelector) {
        handleError(t('There was an error loading the catalogs'));
      }
    },
  });

  const catalogOptions = catalogData || EMPTY_CATALOG_OPTIONS;

  function changeDatabase(
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
        ariaLabel={t('Select database or type to search databases')}
        optionFilterProps={['database_name', 'value']}
        data-test="select-database"
        header={<FormLabel>{t('Database')}</FormLabel>}
        lazyLoading={false}
        notFoundContent={emptyState}
        onChange={changeDatabase}
        value={currentDb}
        placeholder={t('Select database or type to search databases')}
        disabled={!isDatabaseSelectEnabled || readOnly}
        options={loadDatabases}
        sortComparator={sortComparator}
      />,
      null,
    );
  }

  function renderCatalogSelect() {
    const refreshIcon = !readOnly && (
      <RefreshLabel
        onClick={refetchCatalogs}
        tooltipContent={t('Force refresh catalog list')}
      />
    );
    return renderSelectRow(
      <Select
        ariaLabel={t('Select catalog or type to search catalogs')}
        disabled={!currentDb || readOnly}
        header={<FormLabel>{t('Catalog')}</FormLabel>}
        labelInValue
        loading={loadingCatalogs}
        name="select-catalog"
        notFoundContent={t('No compatible catalog found')}
        placeholder={t('Select catalog or type to search catalogs')}
        onChange={item => changeCatalog(item as CatalogOption)}
        options={catalogOptions}
        showSearch
        value={currentCatalog || undefined}
      />,
      refreshIcon,
    );
  }

  function renderSchemaSelect() {
    const refreshIcon = !readOnly && (
      <RefreshLabel
        onClick={refetchSchemas}
        tooltipContent={t('Force refresh schema list')}
      />
    );
    return renderSelectRow(
      <Select
        ariaLabel={t('Select schema or type to search schemas')}
        disabled={!currentDb || readOnly}
        header={<FormLabel>{t('Schema')}</FormLabel>}
        labelInValue
        loading={loadingSchemas}
        name="select-schema"
        notFoundContent={t('No compatible schema found')}
        placeholder={t('Select schema or type to search schemas')}
        onChange={item => changeSchema(item as SchemaOption)}
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
      {showCatalogSelector && renderCatalogSelect()}
      {renderSchemaSelect()}
    </DatabaseSelectorWrapper>
  );
}
