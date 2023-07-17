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
  useEffect,
  useState,
  SetStateAction,
  Dispatch,
  useCallback,
} from 'react';
import rison from 'rison';
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
import {
  EmptyStateMedium,
  emptyStateComponent,
} from 'src/components/EmptyState';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { LocalStorageKeys, getItem } from 'src/utils/localStorageHelpers';
import {
  DatasetActionType,
  DatasetObject,
} from 'src/features/datasets/AddDataset/types';

interface LeftPanelProps {
  setDataset: Dispatch<SetStateAction<object>>;
  dataset?: Partial<DatasetObject> | null;
  datasetNames?: (string | null | undefined)[] | undefined;
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
      top: ${theme.gridUnit * 38.75}px;
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

      .no-scrollbar {
        margin-right: ${theme.gridUnit * 4}px;
      }

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
      top: ${theme.gridUnit * 69}px;
      left: ${theme.gridUnit * 42.75}px;
      font-size: ${theme.gridUnit * 4.25}px;
    }
    .table-form {
      margin-bottom: ${theme.gridUnit * 8}px;
    }
    .loading-container {
      position: absolute;
      top: ${theme.gridUnit * 89.75}px;
      left: 0;
      right: 0;
      text-align: center;
      img {
        width: ${theme.gridUnit * 20}px;
        margin-bottom: ${theme.gridUnit * 2.5}px;
      }
      p {
        color: ${theme.colors.grayscale.light1};
      }
    }
`}
`;

export default function LeftPanel({
  setDataset,
  dataset,
  datasetNames,
}: LeftPanelProps) {
  const theme = useTheme();

  const [tableOptions, setTableOptions] = useState<Array<TableOption>>([]);
  const [resetTables, setResetTables] = useState(false);
  const [loadTables, setLoadTables] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [refresh, setRefresh] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const { addDangerToast } = useToasts();

  const setDatabase = useCallback(
    (db: Partial<DatabaseObject>) => {
      setDataset({ type: DatasetActionType.selectDatabase, payload: { db } });
      setSelectedTable(null);
      setResetTables(true);
    },
    [setDataset],
  );

  const setTable = (tableName: string, index: number) => {
    setSelectedTable(index);
    setDataset({
      type: DatasetActionType.selectTable,
      payload: { name: 'table_name', value: tableName },
    });
  };

  const getTablesList = useCallback(
    (url: string) => {
      SupersetClient.get({ url })
        .then(({ json }) => {
          const options: TableOption[] = json.result.map((table: Table) => {
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
        .catch(error => {
          addDangerToast(t('There was an error fetching tables'));
          logging.error(t('There was an error fetching tables'), error);
        });
    },
    [addDangerToast],
  );

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

  const encodedSchema = dataset?.schema
    ? encodeURIComponent(dataset?.schema)
    : undefined;

  useEffect(() => {
    const currentUserSelectedDb = getItem(
      LocalStorageKeys.db,
      null,
    ) as DatabaseObject;
    if (currentUserSelectedDb) {
      setDatabase(currentUserSelectedDb);
    }
  }, [setDatabase]);

  useEffect(() => {
    if (loadTables) {
      const params = rison.encode({
        force: refresh,
        schema_name: encodedSchema,
      });

      const endpoint = `/api/v1/database/${dataset?.db?.id}/tables/?q=${params}`;
      getTablesList(endpoint);
    }
  }, [loadTables, dataset?.db?.id, encodedSchema, getTablesList, refresh]);

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

  const optionsList = document.getElementsByClassName('options-list');
  const scrollableOptionsList =
    optionsList[0]?.scrollHeight > optionsList[0]?.clientHeight;
  const [emptyResultsWithSearch, setEmptyResultsWithSearch] = useState(false);

  const onEmptyResults = (searchText?: string) => {
    setEmptyResultsWithSearch(!!searchText);
  };

  return (
    <LeftPanelStyle>
      <p className="section-title db-schema">
        {SELECT_DATABASE_AND_SCHEMA_TEXT}
      </p>
      <DatabaseSelector
        db={dataset?.db}
        handleError={addDangerToast}
        onDbChange={setDatabase}
        onSchemaChange={setSchema}
        emptyState={emptyStateComponent(emptyResultsWithSearch)}
        onEmptyResults={onEmptyResults}
      />
      {loadTables && !refresh && Loader(TABLE_LOADING_TEXT)}
      {dataset?.schema && !loadTables && !tableOptions.length && !searchVal && (
        <div className="emptystate">
          <EmptyStateMedium
            image="empty-table.svg"
            title={NO_TABLES_FOUND_TITLE}
            description={NO_TABLES_FOUND_DESCRIPTION}
          />
        </div>
      )}

      {dataset?.schema && (tableOptions.length > 0 || searchVal.length > 0) && (
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
                    selectedTable === i
                      ? scrollableOptionsList
                        ? 'options-highlighted'
                        : 'options-highlighted no-scrollbar'
                      : scrollableOptionsList
                      ? 'options'
                      : 'options no-scrollbar'
                  }
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTable(option.value, i)}
                >
                  {option.label}
                  {datasetNames?.includes(option.value) && (
                    <Icons.Warning
                      iconColor={
                        selectedTable === i
                          ? theme.colors.grayscale.light5
                          : theme.colors.info.base
                      }
                      iconSize="m"
                      css={css`
                        margin-right: ${theme.gridUnit * 2}px;
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
