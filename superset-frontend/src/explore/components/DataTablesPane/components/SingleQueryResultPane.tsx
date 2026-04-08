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
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  getTimeFormatter,
  safeHtmlSpan,
  TimeFormats,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { Constants } from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/common';
import { GridTable } from 'src/components/GridTable';
import { GridSize } from 'src/components/GridTable/constants';
import { TableControls } from './DataTableControls';
import { SingleQueryResultPaneProp } from '../types';

const GridContainer = styled.div`
  flex: 1;
  overflow: hidden;
`;

const timeFormatter = getTimeFormatter(TimeFormats.DATABASE_DATETIME);

export const SingleQueryResultPane = ({
  data,
  colnames,
  coltypes,
  rowcount,
  datasourceId,
  dataSize = 50,
  isVisible,
  canDownload,
  columnDisplayNames,
}: SingleQueryResultPaneProp) => {
  const [filterText, setFilterText] = useState('');
  const [gridHeight, setGridHeight] = useState(300);
  const gridContainerRef = useRef<HTMLDivElement>(null);

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
              const headerLabel = columnDisplayNames?.[key] ?? key;
              return {
                label: key,
                headerName: headerLabel,
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
    [colnames, data, coltypes, columnDisplayNames],
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

  return (
    <>
      <TableControls
        data={data}
        columnNames={colnames}
        columnTypes={coltypes}
        rowcount={rowcount}
        datasourceId={datasourceId}
        onInputChange={handleInputChange}
        isLoading={false}
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
