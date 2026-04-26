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
import { useState, useEffect, useMemo, useCallback } from 'react';
import { t } from '@apache-superset/core/translation';
import { ensureIsArray } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/common';
import { GridTable } from 'src/components/GridTable';
import { GridSize } from 'src/components/GridTable/constants';
import { getDatasourceSamples } from 'src/components/Chart/chartAction';
import { getDrillPayload } from 'src/components/Chart/DrillDetail/utils';
import {
  useGridColumns,
  useKeywordFilter,
  useGridHeight,
} from './useGridResultTable';
import { TableControls, ROW_LIMIT_OPTIONS } from './DataTableControls';
import { SamplesPaneProps } from '../types';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.sizeUnit * 4}px`};
`;

const GridContainer = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const GridSizer = styled.div`
  position: absolute;
  inset: 0;
`;

const cache = new WeakMap();

const DEFAULT_ROW_LIMIT = 100;

export const SamplesPane = ({
  isRequest,
  datasource,
  queryFormData,
  queryForce,
  setForceQuery,
  isVisible,
  canDownload,
}: SamplesPaneProps) => {
  const [filterText, setFilterText] = useState('');
  const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT);
  const [data, setData] = useState<Record<string, any>[][]>([]);
  const [colnames, setColnames] = useState<string[]>([]);
  const [collabels, setCollabels] = useState<string[]>([]);
  const [coltypes, setColtypes] = useState<GenericDataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rowcount, setRowCount] = useState<number>(0);
  const [responseError, setResponseError] = useState<string>('');
  const { gridHeight, measuredRef } = useGridHeight();
  const datasourceId = useMemo(
    () => `${datasource.id}__${datasource.type}`,
    [datasource],
  );

  const handleRowLimitChange = useCallback(
    (limit: number) => {
      setRowLimit(limit);
      cache.delete(queryFormData);
    },
    [queryFormData],
  );

  useEffect(() => {
    if (isRequest && queryForce) {
      cache.delete(queryFormData);
    }

    if (isRequest && !cache.has(queryFormData)) {
      setIsLoading(true);
      const payload =
        getDrillPayload(
          queryFormData as Parameters<typeof getDrillPayload>[0],
        ) ?? {};
      getDatasourceSamples(
        datasource.type,
        datasource.id,
        queryForce,
        payload,
        rowLimit,
        1,
      )
        .then(response => {
          setData(ensureIsArray(response.data));
          setColnames(ensureIsArray(response.colnames));
          setCollabels(ensureIsArray(response.collabels));
          setColtypes(ensureIsArray(response.coltypes));
          setRowCount(response.rowcount);
          setResponseError('');
          cache.set(queryFormData, true);
          if (queryForce) {
            setForceQuery?.(false);
          }
        })
        .catch(error => {
          setData([]);
          setColnames([]);
          setCollabels([]);
          setColtypes([]);
          setResponseError(`${error.name}: ${error.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [datasource, queryFormData, isRequest, queryForce, rowLimit]);

  const columns = useGridColumns(colnames, coltypes, data, collabels);
  const keywordFilter = useKeywordFilter(filterText);

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
          rowLimit={rowLimit}
          rowLimitOptions={ROW_LIMIT_OPTIONS}
          onRowLimitChange={handleRowLimitChange}
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
        rowLimit={rowLimit}
        rowLimitOptions={ROW_LIMIT_OPTIONS}
        onRowLimitChange={handleRowLimitChange}
      />
      <GridContainer>
        <GridSizer ref={measuredRef}>
          <GridTable
            data={data}
            columns={columns}
            height={gridHeight}
            size={GridSize.Small}
            externalFilter={keywordFilter}
            showRowNumber
          />
        </GridSizer>
      </GridContainer>
    </>
  );
};
