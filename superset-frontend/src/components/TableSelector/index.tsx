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
import React, {
  FunctionComponent,
  useState,
  ReactNode,
  useMemo,
  useEffect,
} from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import { Select } from 'src/components';
import { FormLabel } from 'src/components/Form';
import Icons from 'src/components/Icons';
import DatabaseSelector, {
  DatabaseObject,
} from 'src/components/DatabaseSelector';
import RefreshLabel from 'src/components/RefreshLabel';
import CertifiedIcon from 'src/components/CertifiedIcon';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';

const TableSelectorWrapper = styled.div`
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

    .divider {
      border-bottom: 1px solid ${theme.colors.secondary.light5};
      margin: 15px 0;
    }

    .table-length {
      color: ${theme.colors.grayscale.light1};
    }

    .select {
      flex: 1;
    }
  `}
`;

const TableLabel = styled.span`
  align-items: center;
  display: flex;
  white-space: nowrap;

  svg,
  small {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

interface TableSelectorProps {
  clearable?: boolean;
  database?: DatabaseObject;
  formMode?: boolean;
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: DatabaseObject) => void;
  onSchemaChange?: (schema?: string) => void;
  onSchemasLoad?: () => void;
  onTableChange?: (tableName?: string, schema?: string) => void;
  onTablesLoad?: (options: Array<any>) => void;
  readOnly?: boolean;
  schema?: string;
  sqlLabMode?: boolean;
  tableName?: string;
}

interface Table {
  label: string;
  value: string;
  type: string;
  extra?: {
    certification?: {
      certified_by: string;
      details: string;
    };
    warning_markdown?: string;
  };
}

interface TableOption {
  label: JSX.Element;
  text: string;
  value: string;
}

const TableOption = ({ table }: { table: Table }) => {
  const { label, type, extra } = table;
  return (
    <TableLabel title={label}>
      {type === 'view' ? (
        <Icons.Eye iconSize="m" />
      ) : (
        <Icons.Table iconSize="m" />
      )}
      {extra?.certification && (
        <CertifiedIcon
          certifiedBy={extra.certification.certified_by}
          details={extra.certification.details}
          size="l"
        />
      )}
      {extra?.warning_markdown && (
        <WarningIconWithTooltip
          warningMarkdown={extra.warning_markdown}
          size="l"
        />
      )}
      {label}
    </TableLabel>
  );
};

const TableSelector: FunctionComponent<TableSelectorProps> = ({
  database,
  formMode = false,
  getDbList,
  handleError,
  isDatabaseSelectEnabled = true,
  onDbChange,
  onSchemaChange,
  onSchemasLoad,
  onTableChange,
  onTablesLoad,
  readOnly = false,
  schema,
  sqlLabMode = true,
  tableName,
}) => {
  const [currentDatabase, setCurrentDatabase] = useState<
    DatabaseObject | undefined
  >(database);
  const [currentSchema, setCurrentSchema] = useState<string | undefined>(
    schema,
  );
  const [currentTable, setCurrentTable] = useState<TableOption | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [previousRefresh, setPreviousRefresh] = useState(0);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableOptions, setTableOptions] = useState<TableOption[]>([]);

  useEffect(() => {
    // reset selections
    if (database === undefined) {
      setCurrentDatabase(undefined);
      setCurrentSchema(undefined);
      setCurrentTable(undefined);
    }
  }, [database]);

  useEffect(() => {
    if (currentDatabase && currentSchema) {
      setLoadingTables(true);
      const encodedSchema = encodeURIComponent(currentSchema);
      const forceRefresh = refresh !== previousRefresh;
      // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
      const endpoint = encodeURI(
        `/superset/tables/${currentDatabase.id}/${encodedSchema}/undefined/${forceRefresh}/`,
      );

      if (previousRefresh !== refresh) {
        setPreviousRefresh(refresh);
      }

      SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const options: TableOption[] = [];
          let currentTable;
          json.options.forEach((table: Table) => {
            const option = {
              value: table.value,
              label: <TableOption table={table} />,
              text: table.label,
            };
            options.push(option);
            if (table.label === tableName) {
              currentTable = option;
            }
          });
          if (onTablesLoad) {
            onTablesLoad(json.options);
          }
          setTableOptions(
            options.sort((a: { text: string }, b: { text: string }) =>
              a.text.localeCompare(b.text),
            ),
          );
          setCurrentTable(currentTable);
          setLoadingTables(false);
        })
        .catch(e => {
          setLoadingTables(false);
          handleError(t('There was an error loading the tables'));
        });
    }
    // We are using the refresh state to re-trigger the query
    // previousRefresh should be out of dependencies array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDatabase, currentSchema, onTablesLoad, refresh]);

  function renderSelectRow(select: ReactNode, refreshBtn: ReactNode) {
    return (
      <div className="section">
        <span className="select">{select}</span>
        <span className="refresh">{refreshBtn}</span>
      </div>
    );
  }

  const internalTableChange = (table?: TableOption) => {
    setCurrentTable(table);
    if (onTableChange && currentSchema) {
      onTableChange(table?.value, currentSchema);
    }
  };

  const internalDbChange = (db: DatabaseObject) => {
    setCurrentDatabase(db);
    if (onDbChange) {
      onDbChange(db);
    }
  };

  const internalSchemaChange = (schema?: string) => {
    setCurrentSchema(schema);
    if (onSchemaChange) {
      onSchemaChange(schema);
    }
    internalTableChange(undefined);
  };

  function renderDatabaseSelector() {
    return (
      <DatabaseSelector
        key={currentDatabase?.id}
        db={currentDatabase}
        formMode={formMode}
        getDbList={getDbList}
        handleError={handleError}
        onDbChange={readOnly ? undefined : internalDbChange}
        onSchemaChange={readOnly ? undefined : internalSchemaChange}
        onSchemasLoad={onSchemasLoad}
        schema={currentSchema}
        sqlLabMode={sqlLabMode}
        isDatabaseSelectEnabled={isDatabaseSelectEnabled && !readOnly}
        readOnly={readOnly}
      />
    );
  }

  const handleFilterOption = useMemo(
    () => (search: string, option: TableOption) => {
      const searchValue = search.trim().toLowerCase();
      const { text } = option;
      return text.toLowerCase().includes(searchValue);
    },
    [],
  );

  function renderTableSelect() {
    const disabled =
      (currentSchema && !formMode && readOnly) ||
      (!currentSchema && !database?.allow_multi_schema_metadata_fetch);

    const header = sqlLabMode ? (
      <FormLabel>{t('See table schema')}</FormLabel>
    ) : (
      <FormLabel>{t('Table')}</FormLabel>
    );

    const select = (
      <Select
        ariaLabel={t('Select table or type table name')}
        disabled={disabled}
        filterOption={handleFilterOption}
        header={header}
        labelInValue
        lazyLoading={false}
        loading={loadingTables}
        name="select-table"
        onChange={(table: TableOption) => internalTableChange(table)}
        options={tableOptions}
        placeholder={t('Select table or type table name')}
        showSearch
        value={currentTable}
      />
    );

    const refreshLabel = !formMode && !readOnly && (
      <RefreshLabel
        onClick={() => setRefresh(refresh + 1)}
        tooltipContent={t('Force refresh table list')}
      />
    );

    return renderSelectRow(select, refreshLabel);
  }

  return (
    <TableSelectorWrapper>
      {renderDatabaseSelector()}
      {sqlLabMode && !formMode && <div className="divider" />}
      {renderTableSelect()}
    </TableSelectorWrapper>
  );
};

export default TableSelector;
