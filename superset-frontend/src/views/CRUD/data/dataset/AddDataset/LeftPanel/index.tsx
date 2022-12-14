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
import React, { useEffect, useState, SetStateAction, Dispatch } from 'react';
import {
  SupersetClient,
  t,
  styled,
  css,
  useTheme,
  logging,
} from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Form } from 'src/components/Form';
import Icons from 'src/components/Icons';
import { TableOption } from 'src/components/TableSelector';
import RefreshLabel from 'src/components/RefreshLabel';
import { Table } from 'src/hooks/apiResources';
import Loading from 'src/components/Loading';
import DatabaseSelector, {
  DatabaseObject,
} from 'src/components/DatabaseSelector';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DatasetActionType } from '../types';

interface LeftPanelProps {
  setDataset: Dispatch<SetStateAction<object>>;
  schema?: string | null | undefined;
  dbId?: number;
  datasets?: (string | null | undefined)[] | undefined;
}

const SearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const LeftPanelStyle = styled.div`
  ${({ theme }) => `
    max-width: ${theme.gridUnit * 87.5}px;
    padding: ${theme.gridUnit * 4}px;
    height: 100%;
    background-color: ${theme.colors.grayscale.light5};
    position: relative;
    .emptystate {
      height: auto;
      margin-top: ${theme.gridUnit * 17.5}px;
    }
    .refresh {
      position: absolute;
      top: ${theme.gridUnit * 37.25}px;
      left: ${theme.gridUnit * 16.75}px;
      span[role="button"]{
        font-size: ${theme.gridUnit * 4.25}px;
      }
    }
    .section-title {
      margin-top: ${theme.gridUnit * 5.5}px;
      margin-bottom: ${theme.gridUnit * 11}px;
      font-weight: ${theme.typography.weights.bold};
    }
    .table-title {
      margin-top: ${theme.gridUnit * 11}px;
      margin-bottom: ${theme.gridUnit * 6}px;
      font-weight: ${theme.typography.weights.bold};
    }
    .options-list {
      overflow: auto;
      position: absolute;
      bottom: 0;
      top: ${theme.gridUnit * 92.25}px;
      left: ${theme.gridUnit * 3.25}px;
      right: 0;

      .options {
        cursor: pointer;
        padding: ${theme.gridUnit * 1.75}px;
        border-radius: ${theme.borderRadius}px;
        :hover {
          background-color: ${theme.colors.grayscale.light4}
        }
      }

      .options-highlighted {
        cursor: pointer;
        padding: ${theme.gridUnit * 1.75}px;
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.primary.dark1};
        color: ${theme.colors.grayscale.light5};
      }

      .options, .options-highlighted {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
    form > span[aria-label="refresh"] {
      position: absolute;
      top: ${theme.gridUnit * 67.5}px;
      left: ${theme.gridUnit * 42.75}px;
      font-size: ${theme.gridUnit * 4.25}px;
    }
    .table-form {
      margin-bottom: ${theme.gridUnit * 8}px;
    }
    .loading-container {
      position: absolute;
      top: 359px;
      left: 0;
      right: 0;
      text-align: center;
      img {
        width: ${theme.gridUnit * 20}px;
        margin-bottom: 10px;
      }
      p {
        color: ${theme.colors.grayscale.light1};
      }
    }
`}
`;

export default function LeftPanel({
  setDataset,
  schema,
  dbId,
  datasets,
}: LeftPanelProps) {
  const theme = useTheme();

  const [tableOptions, setTableOptions] = useState<Array<TableOption>>([]);
  const [resetTables, setResetTables] = useState(false);
  const [loadTables, setLoadTables] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [refresh, setRefresh] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const { addDangerToast } = useToasts();

  const setDatabase = (db: Partial<DatabaseObject>) => {
    setDataset({ type: DatasetActionType.selectDatabase, payload: { db } });
    setSelectedTable(null);
    setResetTables(true);
  };

  const setTable = (tableName: string, index: number) => {
    setSelectedTable(index);
    setDataset({
      type: DatasetActionType.selectTable,
      payload: { name: 'table_name', value: tableName },
    });
  };

  const getTablesList = (url: string) => {
    SupersetClient.get({ url })
      .then(({ json }) => {
        const options: TableOption[] = json.options.map((table: Table) => {
          const option: TableOption = {
            value: table.value,
            label: <TableOption table={table} />,
            text: table.label,
          };

          return option;
        });

        setTableOptions(options);
        setLoadTables(false);
        setResetTables(false);
        setRefresh(false);
      })
      .catch(error =>
        logging.error('There was an error fetching tables', error),
      );
  };

  const setSchema = (schema: string) => {
    if (schema) {
      setDataset({
        type: DatasetActionType.selectSchema,
        payload: { name: 'schema', value: schema },
      });
      setLoadTables(true);
    }
    setSelectedTable(null);
    setResetTables(true);
  };

  const encodedSchema = schema ? encodeURIComponent(schema) : undefined;

  useEffect(() => {
    if (loadTables) {
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/${encodedSchema}/${refresh}/`,
      );
      getTablesList(endpoint);
    }
  }, [loadTables]);

  useEffect(() => {
    if (resetTables) {
      setTableOptions([]);
      setResetTables(false);
    }
  }, [resetTables]);

  const filteredOptions = tableOptions.filter(option =>
    option?.value?.toLowerCase().includes(searchVal.toLowerCase()),
  );

  const Loader = (inline: string) => (
    <div className="loading-container">
      <Loading position="inline" />
      <p>{inline}</p>
    </div>
  );

  const SELECT_DATABASE_AND_SCHEMA_TEXT = t('Select database & schema');
  const TABLE_LOADING_TEXT = t('Table loading');
  const NO_TABLES_FOUND_TITLE = t('No database tables found');
  const NO_TABLES_FOUND_DESCRIPTION = t('Try selecting a different schema');
  const SELECT_DATABASE_TABLE_TEXT = t('Select database table');
  const REFRESH_TABLE_LIST_TOOLTIP = t('Refresh table list');
  const REFRESH_TABLES_TEXT = t('Refresh tables');
  const SEARCH_TABLES_PLACEHOLDER_TEXT = t('Search tables');

  return (
    <LeftPanelStyle>
      <p className="section-title db-schema">
        {SELECT_DATABASE_AND_SCHEMA_TEXT}
      </p>
      <DatabaseSelector
        handleError={addDangerToast}
        onDbChange={setDatabase}
        onSchemaChange={setSchema}
      />
      {loadTables && !refresh && Loader(TABLE_LOADING_TEXT)}
      {schema && !loadTables && !tableOptions.length && !searchVal && (
        <div className="emptystate">
          <EmptyStateMedium
            image="empty-table.svg"
            title={NO_TABLES_FOUND_TITLE}
            description={NO_TABLES_FOUND_DESCRIPTION}
          />
        </div>
      )}

      {schema && (tableOptions.length > 0 || searchVal.length > 0) && (
        <>
          <Form>
            <p className="table-title">{SELECT_DATABASE_TABLE_TEXT}</p>
            <RefreshLabel
              onClick={() => {
                setLoadTables(true);
                setRefresh(true);
              }}
              tooltipContent={REFRESH_TABLE_LIST_TOOLTIP}
            />
            {refresh && Loader(REFRESH_TABLES_TEXT)}
            {!refresh && (
              <Input
                value={searchVal}
                prefix={<SearchIcon iconSize="l" />}
                onChange={evt => {
                  setSearchVal(evt.target.value);
                }}
                className="table-form"
                placeholder={SEARCH_TABLES_PLACEHOLDER_TEXT}
                allowClear
              />
            )}
          </Form>
          <div className="options-list" data-test="options-list">
            {!refresh &&
              filteredOptions.map((option, i) => (
                <div
                  className={
                    selectedTable === i ? 'options-highlighted' : 'options'
                  }
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTable(option.value, i)}
                >
                  {option.label}
                  {datasets?.includes(option.value) && (
                    <Icons.Warning
                      iconColor={
                        selectedTable === i
                          ? theme.colors.grayscale.light5
                          : theme.colors.info.base
                      }
                      iconSize="m"
                      css={css`
                        margin-right: ${theme.gridUnit * 6}px;
                      `}
                    />
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </LeftPanelStyle>
  );
}
