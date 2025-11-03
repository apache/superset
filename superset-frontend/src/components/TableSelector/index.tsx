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
  FunctionComponent,
  useState,
  ReactNode,
  useMemo,
  useEffect,
} from 'react';
import type { SelectValue } from '@superset-ui/core/components';

import {
  styled,
  t,
  getClientErrorMessage,
  getClientErrorObject,
} from '@superset-ui/core';
import { CertifiedBadge, Select } from '@superset-ui/core/components';
import { DatabaseSelector } from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';
import { StyledFormLabel } from 'src/components/DatabaseSelector/styles';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import WarningIconWithTooltip from '@superset-ui/core/components/WarningIconWithTooltip';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useTables, Table } from 'src/hooks/apiResources';

const REFRESH_WIDTH = 30;

const TableSelectorWrapper = styled.div`
  ${({ theme }) => `
    .refresh {
      display: flex;
      align-items: center;
      width: ${REFRESH_WIDTH}px;
      margin-left: ${theme.sizeUnit}px;
    }

    .section {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    .divider {
      border-bottom: 1px solid ${theme.colorSplit};
      margin: 15px 0;
    }

    .table-length {
      color: ${theme.colorTextSecondary};
    }

    .select {
      flex: 1;
      max-width: calc(100% - ${theme.sizeUnit + REFRESH_WIDTH}px)
    }
  `}
`;

const TableLabel = styled.span`
  align-items: center;
  display: flex;
  white-space: nowrap;

  svg,
  small {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

interface TableSelectorProps {
  clearable?: boolean;
  database?: DatabaseObject | null;
  emptyState?: ReactNode;
  formMode?: boolean;
  getDbList?: (arg0: any) => void;
  handleError: (msg: string) => void;
  isDatabaseSelectEnabled?: boolean;
  onDbChange?: (db: DatabaseObject) => void;
  onCatalogChange?: (catalog?: string | null) => void;
  onSchemaChange?: (schema?: string) => void;
  readOnly?: boolean;
  catalog?: string | null;
  schema?: string;
  onEmptyResults?: (searchText?: string) => void;
  sqlLabMode?: boolean;
  tableValue?: string | string[];
  onTableSelectChange?: (
    value?: string | string[],
    catalog?: string | null,
    schema?: string,
  ) => void;
  tableSelectMode?: 'single' | 'multiple';
  customTableOptionLabelRenderer?: (table: Table) => JSX.Element;
}

export interface TableOption {
  label: JSX.Element;
  text: string;
  value: string;
}

export const TableOption = ({ table }: { table: Table }) => {
  const { value, type, extra } = table;
  return (
    <TableLabel title={value}>
      {type === 'view' ? (
        <Icons.EyeOutlined iconSize="m" />
      ) : (
        <Icons.InsertRowAboveOutlined iconSize="m" />
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
          marginRight={4}
        />
      )}
      {value}
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
  onCatalogChange,
  onSchemaChange,
  readOnly = false,
  onEmptyResults,
  catalog,
  schema,
  sqlLabMode = true,
  tableSelectMode = 'single',
  tableValue = undefined,
  onTableSelectChange,
  customTableOptionLabelRenderer,
}) => {
  const { addSuccessToast } = useToasts();
  const [currentCatalog, setCurrentCatalog] = useState<
    string | null | undefined
  >(catalog);
  const [currentSchema, setCurrentSchema] = useState<string | undefined>(
    schema,
  );
  const [tableSelectValue, setTableSelectValue] = useState<
    SelectValue | undefined
  >(undefined);
  const {
    currentData: data,
    isFetching: loadingTables,
    refetch,
  } = useTables({
    dbId: database?.id,
    catalog: currentCatalog,
    schema: currentSchema,
    onSuccess: (data, isFetched) => {
      if (isFetched) {
        addSuccessToast(t('List updated'));
      }
    },
    onError: err => {
      getClientErrorObject(err).then(clientError => {
        handleError(
          getClientErrorMessage(
            t('There was an error loading the tables'),
            clientError,
          ),
        );
      });
    },
  });

  const tableOptions = useMemo<TableOption[]>(
    () =>
      data
        ? data.options.map(table => ({
            value: table.value,
            label: customTableOptionLabelRenderer ? (
              customTableOptionLabelRenderer(table)
            ) : (
              <TableOption table={table} />
            ),
            text: table.value,
          }))
        : [],
    [data, customTableOptionLabelRenderer],
  );

  useEffect(() => {
    // reset selections
    if (database === undefined) {
      setCurrentCatalog(undefined);
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
        currentCatalog,
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

    setCurrentCatalog(undefined);
    setCurrentSchema(undefined);
    const value = tableSelectMode === 'single' ? undefined : [];
    setTableSelectValue(value);
  };

  const internalCatalogChange = (catalog?: string | null) => {
    setCurrentCatalog(catalog);
    if (onCatalogChange) {
      onCatalogChange(catalog);
    }

    setCurrentSchema(undefined);
    const value = tableSelectMode === 'single' ? undefined : [];
    setTableSelectValue(value);
  };

  const internalSchemaChange = (schema?: string) => {
    setCurrentSchema(schema);
    if (onSchemaChange) {
      onSchemaChange(schema);
    }

    const value = tableSelectMode === 'single' ? undefined : [];
    setTableSelectValue(value);
  };

  const handleFilterOption = useMemo(
    () => (search: string, option: TableOption) => {
      const searchValue = search.trim().toLowerCase();
      const { value } = option;
      return value.toLowerCase().includes(searchValue);
    },
    [],
  );

  function renderTableSelect() {
    const disabled = (currentSchema && !formMode && readOnly) || !currentSchema;

    const label = sqlLabMode ? t('See table schema') : t('Table');

    const select = (
      <Select
        ariaLabel={t('Select table or type to search tables')}
        disabled={disabled}
        filterOption={handleFilterOption}
        labelInValue
        loading={loadingTables}
        name="select-table"
        onChange={(options: TableOption | TableOption[]) =>
          internalTableChange(options)
        }
        options={tableOptions}
        placeholder={t('Select table or type to search tables')}
        showSearch
        mode={tableSelectMode}
        value={tableSelectValue}
        allowClear={tableSelectMode === 'multiple'}
        allowSelectAll={false}
      />
    );

    const refreshLabel = !readOnly && (
      <RefreshLabel
        onClick={() => refetch()}
        tooltipContent={t('Force refresh table list')}
      />
    );

    return (
      <>
        <StyledFormLabel>{label}</StyledFormLabel>
        {renderSelectRow(select, refreshLabel)}
      </>
    );
  }

  return (
    <TableSelectorWrapper>
      <DatabaseSelector
        db={database}
        emptyState={emptyState}
        formMode={formMode}
        getDbList={getDbList}
        handleError={handleError}
        onDbChange={readOnly ? undefined : internalDbChange}
        onEmptyResults={onEmptyResults}
        onCatalogChange={readOnly ? undefined : internalCatalogChange}
        catalog={currentCatalog}
        onSchemaChange={readOnly ? undefined : internalSchemaChange}
        schema={currentSchema}
        sqlLabMode={sqlLabMode}
        isDatabaseSelectEnabled={isDatabaseSelectEnabled && !readOnly}
        readOnly={readOnly}
      />
      {sqlLabMode && !formMode && <div className="divider" />}
      {renderTableSelect()}
    </TableSelectorWrapper>
  );
};

export const TableSelectorMultiple: FunctionComponent<
  TableSelectorProps
> = props => <TableSelector tableSelectMode="multiple" {...props} />;

export default TableSelector;
