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
import { SelectValue } from 'antd/lib/select';

import { styled, t } from '@superset-ui/core';
import { Select } from 'src/components';
import { FormLabel } from 'src/components/Form';
import Icons from 'src/components/Icons';
import DatabaseSelector, {
  DatabaseObject,
} from 'src/components/DatabaseSelector';
import RefreshLabel from 'src/components/RefreshLabel';
import CertifiedBadge from 'src/components/CertifiedBadge';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { SchemaOption } from 'src/SqlLab/types';
import { useTables, Table } from 'src/hooks/apiResources';

const REFRESH_WIDTH = 30;

const TableSelectorWrapper = styled.div`
  ${({ theme }) => `
    .refresh {
      display: flex;
      align-items: center;
      width: ${REFRESH_WIDTH}px;
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
      max-width: calc(100% - ${theme.gridUnit + REFRESH_WIDTH}px)
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
  database?: DatabaseObject | null;
  emptyState?: ReactNode;
  formMode?: boolean;
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: DatabaseObject) => void;
  onSchemaChange?: (schema?: string) => void;
  onSchemasLoad?: (schemaOptions: SchemaOption[]) => void;
  onTablesLoad?: (options: Array<any>) => void;
  readOnly?: boolean;
  schema?: string;
  onEmptyResults?: (searchText?: string) => void;
  sqlLabMode?: boolean;
  tableValue?: string | string[];
  onTableSelectChange?: (value?: string | string[], schema?: string) => void;
  tableSelectMode?: 'single' | 'multiple';
}

export interface TableOption {
  label: JSX.Element;
  text: string;
  value: string;
}

export const TableOption = ({ table }: { table: Table }) => {
  const { label, type, extra } = table;
  return (
    <TableLabel title={label}>
      {type === 'view' ? (
        <Icons.Eye iconSize="m" />
      ) : (
        <Icons.Table iconSize="m" />
      )}
      {extra?.certification && (
        <CertifiedBadge
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

function renderSelectRow(select: ReactNode, refreshBtn: ReactNode) {
  return (
    <div className="section">
      <span className="select">{select}</span>
      <span className="refresh">{refreshBtn}</span>
    </div>
  );
}

const TableSelector: FunctionComponent<TableSelectorProps> = ({
  database,
  emptyState,
  formMode = false,
  getDbList,
  handleError,
  isDatabaseSelectEnabled = true,
  onDbChange,
  onSchemaChange,
  onSchemasLoad,
  onTablesLoad,
  readOnly = false,
  onEmptyResults,
  schema,
  sqlLabMode = true,
  tableSelectMode = 'single',
  tableValue = undefined,
  onTableSelectChange,
}) => {
  const { addSuccessToast } = useToasts();
  const [currentSchema, setCurrentSchema] = useState<string | undefined>(
    schema,
  );
  const [tableSelectValue, setTableSelectValue] = useState<
    SelectValue | undefined
  >(undefined);
  const {
    data,
    isFetching: loadingTables,
    isFetched,
    refetch,
  } = useTables({
    dbId: database?.id,
    schema: currentSchema,
    onSuccess: (data: { options: Table[] }) => {
      onTablesLoad?.(data.options);
      if (isFetched) {
        addSuccessToast('List updated');
      }
    },
    onError: () => handleError(t('There was an error loading the tables')),
  });

  const tableOptions = useMemo<TableOption[]>(
    () =>
      data
        ? data.options.map(table => ({
            value: table.value,
            label: <TableOption table={table} />,
            text: table.label,
          }))
        : [],
    [data],
  );

  useEffect(() => {
    // reset selections
    if (database === undefined) {
      setCurrentSchema(undefined);
      setTableSelectValue(undefined);
    }
  }, [database, tableSelectMode]);

  useEffect(() => {
    if (tableSelectMode === 'single') {
      setTableSelectValue(
        tableOptions.find(option => option.value === tableValue),
      );
    } else {
      setTableSelectValue(
        tableOptions?.filter(
          option => option && tableValue?.includes(option.value),
        ) || [],
      );
    }
  }, [tableOptions, tableValue, tableSelectMode]);

  const internalTableChange = (
    selectedOptions: TableOption | TableOption[] | undefined,
  ) => {
    if (currentSchema) {
      onTableSelectChange?.(
        Array.isArray(selectedOptions)
          ? selectedOptions.map(option => option?.value)
          : selectedOptions?.value,
        currentSchema,
      );
    } else {
      setTableSelectValue(selectedOptions);
    }
  };

  const internalDbChange = (db: DatabaseObject) => {
    if (onDbChange) {
      onDbChange(db);
    }
  };

  const internalSchemaChange = (schema?: string) => {
    setCurrentSchema(schema);
    if (onSchemaChange) {
      onSchemaChange(schema);
    }

    const value = tableSelectMode === 'single' ? undefined : [];
    internalTableChange(value);
  };

  function renderDatabaseSelector() {
    return (
      <DatabaseSelector
        key={database?.id}
        db={database}
        emptyState={emptyState}
        formMode={formMode}
        getDbList={getDbList}
        handleError={handleError}
        onDbChange={readOnly ? undefined : internalDbChange}
        onEmptyResults={onEmptyResults}
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
        loading={loadingTables}
        name="select-table"
        onChange={(options: TableOption | TableOption[]) =>
          internalTableChange(options)
        }
        options={tableOptions}
        placeholder={t('Select table or type table name')}
        showSearch
        mode={tableSelectMode}
        value={tableSelectValue}
        allowClear={tableSelectMode === 'multiple'}
      />
    );

    const refreshLabel = !formMode && !readOnly && (
      <RefreshLabel
        onClick={() => refetch()}
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

export const TableSelectorMultiple: FunctionComponent<TableSelectorProps> =
  props => <TableSelector tableSelectMode="multiple" {...props} />;

export default TableSelector;
