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
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { SupersetClient, t, styled, FAST_DEBOUNCE } from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Form } from 'src/components/Form';
import { TableOption, Table } from 'src/components/TableSelector';
import Loading from 'src/components/Loading';
import DatabaseSelector from 'src/components/DatabaseSelector';
import { debounce } from 'lodash';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { DatasetActionType } from '../types';

interface LeftPanelProps {
  setDataset: (db: any) => void;
  schema?: string | undefined | null;
  dbId?: string;
}

const LeftPanelStyle = styled.div`
  ${({ theme }) => `
  max-width: 350px;
  padding: 16px;
  height: 100%;
  background-color: ${theme.colors.grayscale.light5}; 
  .refresh {
    position: absolute;
    top: 290px;
    left: 67px;
    span[role="button"]{
      font-size: 17px;
    }
  }
  .section-title {
    margin-top: 44px;
    margin-bottom: 44px;
    font-weight: 600;
  }
  .options-list {
    overflow: auto;
    max-height: 700px;
    .options {
      margin: 16px;
    }
  }
  .table-form {
    margin-bottom: 32px;
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

  const setDatabase = (db: any) => {
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
      })
      .catch(e => {
        console.log('error', e);
      });
  };

  const setSchema = (schema: any) => {
    if (schema) {
      setDataset({ type: DatasetActionType.selectSchema, payload: schema });
      setLoadTables(true);
    }
    setResetTables(true);
  };

  const encodedSchema = encodeURIComponent(schema as string);
  const forceRefresh = null;

  useEffect(() => {
    if (loadTables) {
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/${encodedSchema}/undefined/${forceRefresh}/`,
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
          `/superset/tables/${dbId}/${encodedSchema}/${encodeTableName}/${forceRefresh}/`,
        );
        getTablesList(endpoint);
      }, FAST_DEBOUNCE),
    [dbId, encodedSchema],
  );

  return (
    <LeftPanelStyle>
      <p className="section-title db-schema"> Select Database & Schema</p>
      <DatabaseSelector
        handleError={() => null}
        onDbChange={setDatabase}
        onSchemaChange={setSchema}
      />
      {loadTables && (
        <div>
          <Loading />
          <p>loading schemas ...</p>
        </div>
      )}
      {!schema && !loadTables ? (
        <>
          <EmptyStateMedium
            image="empty-table.svg"
            title={t('No database tables found')}
            description={t('Try selecting a different schema')}
          />
        </>
      ) : (
        <>
          <Form>
            <p className="section-title">Select Database Table</p>
            <Input
              value={searchVal}
              onChange={evt => {
                search(evt.target.value);
                setSearchVal(evt.target.value);
              }}
              className="table-form"
              placeholder={t('Search Tables')}
            />
          </Form>
          <div className="options-list">
            {tableOptions.map((o, i) => (
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
