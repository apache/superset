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
import { SupersetClient } from '@superset-ui/core';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { styled } from '@superset-ui/core';
import { TableOption, Table } from 'src/components/TableSelector';
import DatabaseSelector from 'src/components/DatabaseSelector';
import { DatasetActionType } from '../types';

interface LeftPanelProps {
  setDataset: (db: any) => void;
  schema?: string | undefined | null;
  dbId?: string;
}

const LeftPanelStyle = styled.div`
  ${({ theme }) => `
  max-width: 350px;
  height: 100%;
  background-color: ${theme.colors.grayscale.light5}; 
  .options-list {
    overflow: auto;
    height: 400px;
  }
`}
`;

export default function LeftPanel({
  setDataset,
  schema,
  dbId,
}: LeftPanelProps) {
  const [tableOptions, setTableOptions] = useState<Array<TableOption>>([]);
  const [page, setPage] = useState({
    startIndex: 0,
    lastIndex: 25,
    length: 0,
  });
  const [resetTables, setResetTables] = useState(false);
  const [loadTables, setLoadTables] = useState(false);

  const setDatabase = (db: any) => {
    setDataset({ type: DatasetActionType.selectDatabase, payload: db });
    setResetTables(true);
  };

  const setSchema = (schema: any) => {
    if (schema) {
      setDataset({ type: DatasetActionType.selectSchema, payload: schema });
      setLoadTables(true);
    }
    setResetTables(true);
  };

  const observer = useRef<IntersectionObserver | null>();
  const lastElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setPage(prev => ({ ...prev, lastIndex: page.lastIndex + 50 }));
      }
    });
    if (node) observer.current.observe(node);
  }, []);

  useEffect(() => {
    if (loadTables) {
      const encodedSchema = encodeURIComponent(schema as string);
      const forceRefresh = null;
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/${encodedSchema}/undefined/${forceRefresh}/`,
      );
      SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const options: TableOption[] = json.options.map((table: Table) => {
            const option: TableOption = {
              value: table.value,
              label: <TableOption table={table} />,
              text: table.label,
            };

            return option;
          });

          setPage(existing => ({ ...existing, length: json.tableLength }));
          setTableOptions(options);
          setLoadTables(false);
          setResetTables(false);
        })
        .catch(e => {
          console.log('error', e);
        });
    }
  }, [loadTables]);

  useEffect(() => {
    if (resetTables) {
      setTableOptions([]);
      setResetTables(false);
    }
  }, [resetTables]);

  const paginatedTabeOptipons = tableOptions.slice(0, page.lastIndex);
  return (
    <LeftPanelStyle>
      <p> Select Database & Schema</p>
      <DatabaseSelector
        handleError={() => null}
        onDbChange={setDatabase}
        onSchemaChange={setSchema}
      />
      <div className="options-list">
        {paginatedTabeOptipons.map((o, i) => {
          if (paginatedTabeOptipons.length === i + 1) {
            return (
              <div key={i} ref={lastElementRef}>
                {o.label}
              </div>
            );
          }
          return <div key={i}>{o.label}</div>;
        })}
      </div>
    </LeftPanelStyle>
  );
}
