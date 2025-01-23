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
import { useState, useEffect, ReactElement } from 'react';

import {
  ensureIsArray,
  styled,
  t,
  getChartMetadataRegistry,
  getClientErrorObject,
} from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { EmptyState } from 'src/components/EmptyState';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { ResultsPaneProps, QueryResultInterface } from '../types';
import { SingleQueryResultPane } from './SingleQueryResultPane';
import { TableControls } from './DataTableControls';

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

const cache = new WeakMap();

export const useResultsPane = ({
  isRequest,
  queryFormData,
  queryForce,
  ownState,
  errorMessage,
  actions,
  isVisible,
  dataSize = 50,
  canDownload,
}: ResultsPaneProps): ReactElement[] => {
  const metadata = getChartMetadataRegistry().get(
    queryFormData?.viz_type || queryFormData?.vizType,
  );

  const [resultResp, setResultResp] = useState<QueryResultInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [responseError, setResponseError] = useState<string>('');
  const queryCount = metadata?.queryObjectCount ?? 1;

  useEffect(() => {
    // it's an invalid formData when gets a errorMessage
    if (errorMessage) return;
    if (isRequest && cache.has(queryFormData)) {
      setResultResp(ensureIsArray(cache.get(queryFormData)));
      setResponseError('');
      if (queryForce && actions) {
        actions.setForceQuery(false);
      }
      setIsLoading(false);
    }
    if (isRequest && !cache.has(queryFormData)) {
      setIsLoading(true);
      getChartDataRequest({
        formData: queryFormData,
        force: queryForce,
        resultFormat: 'json',
        resultType: 'results',
        ownState,
      })
        .then(({ json }) => {
          setResultResp(ensureIsArray(json.result));
          setResponseError('');
          cache.set(queryFormData, json.result);
          if (queryForce && actions) {
            actions.setForceQuery(false);
          }
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setResponseError(error || message || t('Sorry, an error occurred'));
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [queryFormData, isRequest]);

  useEffect(() => {
    if (errorMessage) {
      setIsLoading(false);
    }
  }, [errorMessage]);

  if (isLoading) {
    return Array(queryCount).fill(<Loading />);
  }

  if (errorMessage) {
    const title = t('Run a query to display results');
    return Array(queryCount).fill(
      <EmptyState image="document.svg" title={title} />,
    );
  }

  if (responseError) {
    const err = (
      <>
        <TableControls
          data={[]}
          columnNames={[]}
          columnTypes={[]}
          rowcount={0}
          datasourceId={queryFormData.datasource}
          onInputChange={() => {}}
          isLoading={false}
          canDownload={canDownload}
        />
        <Error>{responseError}</Error>
      </>
    );
    return Array(queryCount).fill(err);
  }

  if (resultResp.length === 0) {
    const title = t('No results were returned for this query');
    return Array(queryCount).fill(
      <EmptyState image="document.svg" title={title} />,
    );
  }
  return resultResp
    .slice(0, queryCount)
    .map((result, idx) => (
      <SingleQueryResultPane
        data={result.data}
        colnames={result.colnames}
        coltypes={result.coltypes}
        rowcount={result.rowcount}
        dataSize={dataSize}
        datasourceId={queryFormData.datasource}
        key={idx}
        isVisible={isVisible}
        canDownload={canDownload}
      />
    ));
};
