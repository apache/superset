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
  useMemo,
  SetStateAction,
  Dispatch,
} from 'react';
import { SupersetClient, t, styled, FAST_DEBOUNCE } from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Form } from 'src/components/Form';
import Icons from 'src/components/Icons';
import { TableOption } from 'src/components/TableSelector';
import RefreshLabel from 'src/components/RefreshLabel';
import { Table } from 'src/hooks/apiResources';
import Loading from 'src/components/Loading';
import DatabaseSelector from 'src/components/DatabaseSelector';
import { debounce } from 'lodash';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DatasetActionType, DatasetObject } from '../types';

interface LeftPanelProps {
  setDataset: Dispatch<SetStateAction<object>>;
  schema?: string | undefined | null;
  dbId?: number;
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
      top: ${theme.gridUnit * 43.25}px;
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
      top: ${theme.gridUnit * 97.5}px;
      left: ${theme.gridUnit * 3.25}px;
      right: 0;
      .options {
        padding: ${theme.gridUnit * 1.75}px;
        border-radius: ${theme.borderRadius}px;
      }
    }
    form > span[aria-label="refresh"] {
      position: absolute;
      top: ${theme.gridUnit * 73}px;
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
        color: ${theme.colors.grayscale.light1}
      }
    }
  }
`}
`;

export default function LeftPanel({
  setDataset,
  schema,
  dbId,
}: LeftPanelProps) {
  const [tableOptions, setTableOptions] = useState<Array<TableOption>>([]);
  const [resetTables, setResetTables] = useState(false);
  const [loadTables, setLoadTables] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [refresh, setRefresh] = useState(false);

  const { addDangerToast } = useToasts();

  const setDatabase = (db: Partial<DatasetObject>) => {
    setDataset({ type: DatasetActionType.selectDatabase, payload: db });
    setResetTables(true);
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
      .catch(e => {
        console.log('error', e);
      });
  };

  const setSchema = (schema: string) => {
    if (schema) {
      setDataset({
        type: DatasetActionType.selectSchema,
        payload: { name: 'schema', value: schema },
      });
      setLoadTables(true);
    }
    setResetTables(true);
  };

  const encodedSchema = schema ? encodeURIComponent(schema) : undefined;

  useEffect(() => {
    if (loadTables) {
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/${encodedSchema}/undefined/${refresh}/`,
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

  const search = useMemo(
    () =>
      debounce((value: string) => {
        const encodeTableName =
          value === '' ? undefined : encodeURIComponent(value);
        const endpoint = encodeURI(
          `/superset/tables/${dbId}/${encodedSchema}/${encodeTableName}/`,
        );
        getTablesList(endpoint);
      }, FAST_DEBOUNCE),
    [dbId, encodedSchema],
  );

  const Loader = (inline: string) => (
    <div className="loading-container">
      <Loading position="inline" />
      <p>{inline} </p>
    </div>
  );

  return (
    <LeftPanelStyle>
      <p className="section-title db-schema">Select database & schema</p>
      <DatabaseSelector
        handleError={addDangerToast}
        onDbChange={setDatabase}
        onSchemaChange={setSchema}
      />
      {loadTables && !refresh && Loader('Table loading')}

      {schema && !loadTables && !tableOptions.length && !searchVal && (
        <div className="emptystate">
          <EmptyStateMedium
            image="empty-table.svg"
            title={t('No database tables found')}
            description={t('Try selecting a different schema')}
          />
        </div>
      )}

      {schema && (tableOptions.length > 0 || searchVal.length > 0) && (
        <>
          <Form>
            <p className="table-title">Select database table</p>
            <RefreshLabel
              onClick={() => {
                setLoadTables(true);
                setRefresh(true);
              }}
              tooltipContent={t('Refresh table list')}
            />
            {refresh && Loader('Refresh tables')}
            {!refresh && (
              <Input
                value={searchVal}
                prefix={<SearchIcon iconSize="l" />}
                onChange={evt => {
                  search(evt.target.value);
                  setSearchVal(evt.target.value);
                }}
                className="table-form"
                placeholder={t('Search tables')}
              />
            )}
          </Form>
          <div className="options-list" data-test="options-list">
            {!refresh &&
              tableOptions.map((o, i) => (
                <div className="options" key={i}>
                  {o.label}
                </div>
              ))}
          </div>
        </>
      )}
    </LeftPanelStyle>
  );
}
