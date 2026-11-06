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
import { isDefined, QueryData } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { SingleQueryResultPane } from 'src/explore/components/DataTablesPane/components/SingleQueryResultPane';
import Tabs from '@superset-ui/core/components/Tabs';

const ResultContainer = styled.div`
  ${() => css`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  `}
`;

export const useResultsTableView = (
  chartDataResult: QueryData[] | undefined,
  datasourceId: string,
  canDownload: boolean,
  onDownloadCSV?: () => void,
  onDownloadXLSX?: () => void,
  onReload?: () => void,
) => {
  if (!isDefined(chartDataResult)) {
    return <div />;
  }
  if (chartDataResult.length === 1) {
    return (
      <ResultContainer data-test="drill-by-results-table">
        <SingleQueryResultPane
          colnames={chartDataResult[0].colnames}
          collabels={chartDataResult[0].collabels}
          coltypes={chartDataResult[0].coltypes}
          rowcount={chartDataResult[0].sql_rowcount}
          data={chartDataResult[0].data}
          datasourceId={datasourceId}
          isVisible
          canDownload={canDownload}
          onDownloadCSV={onDownloadCSV}
          onDownloadXLSX={onDownloadXLSX}
          onReload={onReload}
        />
      </ResultContainer>
    );
  }
  return (
    <Tabs
      defaultActiveKey="result-tab-0"
      items={chartDataResult.map((res, index) => ({
        key: `result-tab-${index}`,
        label: t('Results %s', index + 1),
        children: (
          <ResultContainer>
            <SingleQueryResultPane
              colnames={res.colnames}
              collabels={res.collabels}
              coltypes={res.coltypes}
              data={res.data}
              rowcount={res.sql_rowcount}
              datasourceId={datasourceId}
              isVisible
              canDownload={canDownload}
              onDownloadCSV={onDownloadCSV}
              onDownloadXLSX={onDownloadXLSX}
              onReload={onReload}
            />
          </ResultContainer>
        ),
      }))}
    />
  );
};
