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
import React from 'react';
import { css, styled, isDefined, QueryData, t } from '@superset-ui/core';
import { SingleQueryResultPane } from 'src/explore/components/DataTablesPane/components/SingleQueryResultPane';
import Tabs from 'src/components/Tabs';

const DATA_SIZE = 15;

const PaginationContainer = styled.div`
  ${({ theme }) => css`
    & .pagination-container {
      bottom: ${-theme.gridUnit * 4}px;
    }
  `}
`;

export const useResultsTableView = (
  chartDataResult: QueryData[] | undefined,
  datasourceId: string,
) => {
  if (!isDefined(chartDataResult)) {
    return <div />;
  }
  if (chartDataResult.length === 1) {
    return (
      <PaginationContainer data-test="drill-by-results-table">
        <SingleQueryResultPane
          colnames={chartDataResult[0].colnames}
          coltypes={chartDataResult[0].coltypes}
          data={chartDataResult[0].data}
          dataSize={DATA_SIZE}
          datasourceId={datasourceId}
          isVisible
        />
      </PaginationContainer>
    );
  }
  return (
    <Tabs fullWidth={false} data-test="drill-by-results-tabs">
      {chartDataResult.map((res, index) => (
        <Tabs.TabPane tab={t('Results %s', index + 1)} key={index}>
          <PaginationContainer>
            <SingleQueryResultPane
              colnames={res.colnames}
              coltypes={res.coltypes}
              data={res.data}
              dataSize={DATA_SIZE}
              datasourceId={datasourceId}
              isVisible
            />
          </PaginationContainer>
        </Tabs.TabPane>
      ))}
    </Tabs>
  );
};
