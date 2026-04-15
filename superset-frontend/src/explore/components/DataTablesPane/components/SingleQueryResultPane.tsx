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
import { useState, useCallback } from 'react';
import { styled } from '@apache-superset/core/theme';
import { GridTable } from 'src/components/GridTable';
import { GridSize } from 'src/components/GridTable/constants';
import {
  useGridColumns,
  useKeywordFilter,
  useGridHeight,
} from './useGridResultTable';
import { TableControls } from './DataTableControls';
import { SingleQueryResultPaneProp } from '../types';

const ResultPaneContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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

export const SingleQueryResultPane = ({
  data,
  colnames,
  coltypes,
  rowcount,
  datasourceId,
  canDownload,
  columnDisplayNames,
  rowLimit,
  rowLimitOptions,
  onRowLimitChange,
}: SingleQueryResultPaneProp) => {
  const [filterText, setFilterText] = useState('');
  const { gridHeight, measuredRef } = useGridHeight();

  const columns = useGridColumns(colnames, coltypes, data, columnDisplayNames);
  const keywordFilter = useKeywordFilter(filterText);

  const handleInputChange = useCallback(
    (input: string) => setFilterText(input),
    [],
  );

  return (
    <ResultPaneContainer>
      <TableControls
        data={data}
        columnNames={colnames}
        columnTypes={coltypes}
        rowcount={rowcount}
        datasourceId={datasourceId}
        onInputChange={handleInputChange}
        isLoading={false}
        canDownload={canDownload}
        rowLimit={rowLimit}
        rowLimitOptions={rowLimitOptions}
        onRowLimitChange={onRowLimitChange}
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
    </ResultPaneContainer>
  );
};
