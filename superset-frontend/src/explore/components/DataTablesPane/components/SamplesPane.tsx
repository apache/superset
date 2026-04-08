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
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getTimeFormatter,
  safeHtmlSpan,
  TimeFormats,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import {
  Constants,
  EmptyState,
  Loading,
} from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/common';
import { GridTable } from 'src/components/GridTable';
import { GridSize } from 'src/components/GridTable/constants';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import { TableControls } from './DataTableControls';
import { SamplesPaneProps } from '../types';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.sizeUnit * 4}px`};
`;

const GridContainer = styled.div`
  flex: 1;
  overflow: hidden;
`;

const cache = new WeakSet();

const timeFormatter = getTimeFormatter(TimeFormats.DATABASE_DATETIME);

export const SamplesPane = ({
  isRequest,
  datasource,
  queryForce,
  setForceQuery,
  dataSize = 50,
  isVisible,
  canDownload,
}: SamplesPaneProps) => {
  const [filterText, setFilterText] = useState('');
  const [data, setData] = useState<Record<string, any>[][]>([]);
  const [colnames, setColnames] = useState<string[]>([]);
  const [coltypes, setColtypes] = useState<GenericDataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rowcount, setRowCount] = useState<number>(0);
  const [responseError, setResponseError] = useState<string>('');
  const [gridHeight, setGridHeight] = useState(300);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const datasourceId = useMemo(
    () => `${datasource.id}__${datasource.type}`,
    [datasource],
  );

  useEffect(() => {
    if (isRequest && queryForce) {
      cache.delete(datasource);
    }

    if (isRequest && !cache.has(datasource)) {
      setIsLoading(true);
      getDatasourceSamples(datasource.type, datasource.id, queryForce, {})
        .then(response => {
          setData(ensureIsArray(response.data));
          setColnames(ensureIsArray(response.colnames));
          setColtypes(ensureIsArray(response.coltypes));
          setRowCount(response.rowcount);
          setResponseError('');
          cache.add(datasource);
          if (queryForce) {
            setForceQuery?.(false);
          }
        })
        .catch(error => {
          setData([]);
          setColnames([]);
          setColtypes([]);
          setResponseError(`${error.name}: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [datasource, isRequest, queryForce]);

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setGridHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(
    () =>
      colnames && data?.length
        ? colnames
            .filter((column: string) =>
              Object.keys(data[0]).includes(column),
            )
            .map((key, index) => {
              const colType = coltypes?.[index];
              return {
                label: key,
                headerName: key,
                render: ({ value }: { value: any }) => {
                  if (value === true) {
                    return Constants.BOOL_TRUE_DISPLAY;
                  }
                  if (value === false) {
                    return Constants.BOOL_FALSE_DISPLAY;
                  }
                  if (value === null) {
                    return (
                      <span style={{ color: 'var(--ant-color-text-tertiary)' }}>
                        {Constants.NULL_DISPLAY}
                      </span>
                    );
                  }
                  if (
                    colType === GenericDataType.Temporal &&
                    typeof value === 'number'
                  ) {
                    return timeFormatter(value);
                  }
                  if (typeof value === 'string') {
                    return safeHtmlSpan(value);
                  }
                  return String(value);
                },
              };
            })
        : [],
    [colnames, data, coltypes],
  );

  const keywordFilter = useCallback(
    (node: any) => {
      if (filterText && node.data) {
        const lowerFilter = filterText.toLowerCase();
        return Object.values(node.data).some(
          (value: any) =>
            value != null &&
            String(value).toLowerCase().includes(lowerFilter),
        );
      }
      return true;
    },
    [filterText],
  );

  const handleInputChange = useCallback(
    (input: string) => setFilterText(input),
    [],
  );

  if (isLoading) {
    return <Loading />;
  }

  if (responseError) {
    return (
      <>
        <TableControls
          data={data}
          columnNames={colnames}
          columnTypes={coltypes}
          rowcount={rowcount}
          datasourceId={datasourceId}
          onInputChange={handleInputChange}
          isLoading={isLoading}
          canDownload={canDownload}
        />
        <Error>{responseError}</Error>
      </>
    );
  }

  if (data.length === 0) {
    const title = t('No samples were returned for this dataset');
    return <EmptyState image="document.svg" title={title} />;
  }

  return (
    <>
      <TableControls
        data={data}
        columnNames={colnames}
        columnTypes={coltypes}
        rowcount={rowcount}
        datasourceId={datasourceId}
        onInputChange={handleInputChange}
        isLoading={isLoading}
        canDownload={canDownload}
      />
      <GridContainer ref={gridContainerRef}>
        <GridTable
          data={data}
          columns={columns}
          height={gridHeight}
          size={GridSize.Small}
          externalFilter={keywordFilter}
          showRowNumber
        />
      </GridContainer>
    </>
  );
};
