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
import { t } from '@apache-superset/core';
import { SupersetClient, SupersetError } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import rison from 'rison';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  useCatalogs,
  CatalogOption,
  useSchemas,
  SchemaOption,
} from 'src/hooks/apiResources';
import {
  Select,
  AsyncSelect,
  Label,
  LabeledValue as AntdLabeledValue,
  Button,
  Modal,
  Icons,
} from '@superset-ui/core/components';

import { ErrorMessageWithStackTrace } from 'src/components';
import type {
  DatabaseSelectorProps,
  DatabaseValue,
  DatabaseObject,
} from './types';
import { StyledFormLabel } from './styles';

const DatabaseSelectorWrapper = styled.div<{ horizontal?: boolean }>`
  ${({ theme, horizontal }) =>
    horizontal
      ? `
      display: flex;
      flex-direction: row;
      column-gap: ${theme.sizeUnit * 2}px;
      align-items: center;
      min-width: 0;
      overflow: hidden;

      & .ant-space-compact button {
        padding: ${theme.sizeUnit * 2}px;
      }

      & > button {
        min-width: 0;
        overflow: hidden;
        padding: 0 ${theme.sizeUnit * 2}px;


        & > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
`
      : `
    .refresh {
      display: flex;
      align-items: center;
      width: 30px;
      margin-left: ${theme.sizeUnit}px;
    }

    .section {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    .select {
      width: calc(100% - 30px - ${theme.sizeUnit}px);
      flex: 1;
    }

      > div {
      margin-bottom: ${theme.sizeUnit * 4}px;
`}
`;

const LabelStyle = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: ${({ theme }) => theme.sizeUnit - 2}px;
  min-width: 0;
  overflow: hidden;

  .backend {
    overflow: visible;
    flex-shrink: 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const SelectButton = styled(Button)<{ empty: boolean }>`
  color: ${({ theme, empty }) =>
    empty ? theme.colorTextPlaceholder : theme.colorTextBase};
`;

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

export function DatabaseSelector({
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
  const [errorPayload, setErrorPayload] = useState<SupersetError | null>();
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

  // Modal state for sqlLabMode (Database/Catalog/Schema selector)
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [modalDb, setModalDb] = useState<DatabaseObject | undefined>(undefined);
  const [modalCatalog, setModalCatalog] = useState<
    CatalogOption | null | undefined
  >(undefined);
  const [modalSchema, setModalSchema] = useState<SchemaOption | undefined>(
    undefined,
  );

  const openSelectorModal = useCallback(() => {
    setModalDb(currentDb);
    setModalCatalog(currentCatalog);
    setModalSchema(currentSchema);
    setSelectorModalOpen(true);
  }, [currentDb, currentCatalog, currentSchema]);

  const closeSelectorModal = useCallback(() => {
    setSelectorModalOpen(false);
  }, []);

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
            id: `${row.backend}-${row.database_name}-${row.id}`,
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
      setErrorPayload(null);
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
    onError: error => {
      if (error?.errors) {
        setErrorPayload(error?.errors?.[0]);
      } else {
        handleError(t('There was an error loading the schemas'));
      }
    },
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
      setErrorPayload(null);
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
    onError: error => {
      if (showCatalogSelector) {
        if (error?.errors) {
          setErrorPayload(error?.errors?.[0]);
        } else {
          handleError(t('There was an error loading the catalogs'));
        }
      }
    },
  });

  const catalogOptions = catalogData || EMPTY_CATALOG_OPTIONS;

  const handleModalOk = useCallback(() => {
    // Apply modal selections to actual state
    if (modalDb && modalDb.id !== currentDb?.value) {
      const databaseWithId = { ...modalDb, id: modalDb.id };
      setCurrentDb(databaseWithId as DatabaseValue);
      if (onDbChange) {
        onDbChange(databaseWithId);
      }
    }
    if (modalCatalog?.value !== currentCatalog?.value) {
      setCurrentCatalog(modalCatalog);
      if (onCatalogChange) {
        onCatalogChange(modalCatalog?.value);
      }
    }
    if (modalSchema?.value !== currentSchema?.value) {
      setCurrentSchema(modalSchema);
      if (onSchemaChange) {
        onSchemaChange(modalSchema?.value);
      }
    }
    setSelectorModalOpen(false);
  }, [
    modalDb,
    modalCatalog,
    modalSchema,
    currentDb,
    currentCatalog,
    currentSchema,
    onDbChange,
    onCatalogChange,
    onSchemaChange,
  ]);

  function changeDatabase(
    value: { label: string; value: number },
    database: DatabaseValue,
  ) {
    // the database id is actually stored in the value property; the ID is used
    // for the DOM, so it can't be an integer
    const databaseWithId = { ...database, id: database.value };
    setCurrentDb(databaseWithId);
    setCurrentCatalog(undefined);
    setCurrentSchema(undefined);
    if (onDbChange) {
      onDbChange(databaseWithId);
    }
    if (onCatalogChange) {
      onCatalogChange(undefined);
    }
    if (onSchemaChange) {
      onSchemaChange(undefined);
    }
  }

  function renderSelectRow(
    label: string,
    select: ReactNode,
    refreshBtn: ReactNode,
    sqlLabModeConfig?: {
      displayValue?: ReactNode;
      disabled?: boolean;
      loading?: boolean;
    },
  ) {
    if (sqlLabMode && sqlLabModeConfig) {
      const displayValue = sqlLabModeConfig.displayValue ?? label;
      return (
        <SelectButton
          buttonStyle="tertiary"
          disabled={sqlLabModeConfig.disabled}
          loading={sqlLabModeConfig.loading}
          onClick={openSelectorModal}
          icon={<Icons.DownOutlined iconSize="s" />}
          iconPosition="end"
          empty={!sqlLabModeConfig.displayValue}
        >
          {displayValue}
        </SelectButton>
      );
    }
    return (
      <>
        <StyledFormLabel>{label}</StyledFormLabel>
        <div className="section">
          <span className="select">{select}</span>
          <span className="refresh">{refreshBtn}</span>
        </div>
      </>
    );
  }

  function renderDatabaseSelect() {
    if (sqlLabMode) {
      return renderSelectRow(
        t('Select database or type to search databases'),
        null,
        null,
        {
          displayValue: currentDb ? (
            <SelectLabel
              backend={currentDb.backend}
              databaseName={currentDb.database_name}
            />
          ) : undefined,
          disabled: !isDatabaseSelectEnabled || readOnly,
        },
      );
    }
    return (
      <div>
        {renderSelectRow(
          t('Database'),
          <AsyncSelect
            ariaLabel={t('Select database or type to search databases')}
            optionFilterProps={['database_name', 'value']}
            data-test="select-database"
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
        )}
      </div>
    );
  }

  function renderCatalogSelect() {
    if (sqlLabMode) {
      return renderSelectRow(
        t('Select catalog or type to search catalogs'),
        null,
        null,
        {
          displayValue: currentCatalog?.label,
          disabled: !currentDb || readOnly,
          loading: loadingCatalogs,
        },
      );
    }
    const refreshIcon = !readOnly && (
      <RefreshLabel
        onClick={refetchCatalogs}
        tooltipContent={t('Force refresh catalog list')}
      />
    );

    return (
      <>
        {renderSelectRow(
          t('Catalog'),
          <Select
            ariaLabel={t('Select catalog or type to search catalogs')}
            disabled={!currentDb || readOnly}
            labelInValue
            loading={loadingCatalogs}
            name="select-catalog"
            notFoundContent={t('No compatible catalog found')}
            placeholder={t('Select catalog or type to search catalogs')}
            onChange={item => changeCatalog(item as CatalogOption)}
            options={catalogOptions}
            showSearch
            value={currentCatalog || undefined}
            allowClear
          />,
          refreshIcon,
        )}
      </>
    );
  }

  function renderSchemaSelect() {
    if (sqlLabMode) {
      return renderSelectRow(
        t('Select schema or type to search schemas'),
        null,
        null,
        {
          displayValue: currentSchema?.label,
          disabled: !currentDb || readOnly,
          loading: loadingSchemas,
        },
      );
    }
    const refreshIcon = !readOnly && (
      <RefreshLabel
        onClick={refetchSchemas}
        tooltipContent={t('Force refresh schema list')}
      />
    );

    return (
      <>
        {renderSelectRow(
          t('Schema'),
          <Select
            ariaLabel={t('Select schema or type to search schemas')}
            disabled={!currentDb || readOnly}
            labelInValue
            loading={loadingSchemas}
            name="select-schema"
            notFoundContent={t('No compatible schema found')}
            placeholder={t('Select schema or type to search schemas')}
            onChange={item => changeSchema(item as SchemaOption)}
            options={schemaOptions}
            showSearch
            value={currentSchema}
            allowClear
          />,
          refreshIcon,
        )}
      </>
    );
  }

  function renderError() {
    return errorPayload ? (
      <ErrorMessageWithStackTrace error={errorPayload} source="crud" />
    ) : null;
  }

  function renderSelectorModal() {
    return (
      <Modal
        title={t('Select Database and Schema')}
        show={selectorModalOpen}
        onHide={closeSelectorModal}
        onHandledPrimaryAction={handleModalOk}
        css={css`
          .ant-modal-body {
            overflow: visible;
          }
        `}
      >
        <DatabaseSelector
          db={modalDb}
          emptyState={emptyState}
          formMode={formMode}
          getDbList={getDbList}
          handleError={handleError}
          onDbChange={setModalDb}
          onEmptyResults={onEmptyResults}
          onCatalogChange={catalog =>
            setModalCatalog(
              catalog
                ? { label: catalog, value: catalog, title: catalog }
                : undefined,
            )
          }
          catalog={modalCatalog?.value}
          onSchemaChange={schema =>
            setModalSchema(
              schema
                ? { label: schema, value: schema, title: schema }
                : undefined,
            )
          }
          schema={modalSchema?.value}
          sqlLabMode={false}
          isDatabaseSelectEnabled={isDatabaseSelectEnabled}
          readOnly={readOnly}
        />
      </Modal>
    );
  }

  return (
    <DatabaseSelectorWrapper
      data-test="DatabaseSelector"
      horizontal={Boolean(sqlLabMode)}
    >
      {renderDatabaseSelect()}
      {renderError()}
      {showCatalogSelector && renderCatalogSelect()}
      {renderSchemaSelect()}
      {renderSelectorModal()}
    </DatabaseSelectorWrapper>
  );
}

export type { DatabaseObject };
