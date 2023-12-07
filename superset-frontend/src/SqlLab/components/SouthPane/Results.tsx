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
import { shallowEqual, useSelector } from 'react-redux';
import Alert from 'src/components/Alert';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { FeatureFlag, styled, t, isFeatureEnabled } from '@superset-ui/core';

import { SqlLabRootState } from 'src/SqlLab/types';
import ResultSet from '../ResultSet';
import { LOCALSTORAGE_MAX_QUERY_AGE_MS } from '../../constants';

const EXTRA_HEIGHT_RESULTS = 8; // we need extra height in RESULTS tab. because the height from props was calculated based on PREVIEW tab.

type Props = {
  latestQueryId: string;
  height: number;
  displayLimit: number;
  defaultQueryLimit: number;
};

const StyledEmptyStateWrapper = styled.div`
  height: 100%;
  .ant-empty-image img {
    margin-right: 28px;
  }

  p {
    margin-right: 28px;
  }
`;

const Results: React.FC<Props> = ({
  latestQueryId,
  height,
  displayLimit,
  defaultQueryLimit,
}) => {
  const databases = useSelector(
    ({ sqlLab: { databases } }: SqlLabRootState) => databases,
    shallowEqual,
  );
  const latestQuery = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) => queries[latestQueryId || ''],
    shallowEqual,
  );

  if (
    !latestQuery ||
    Date.now() - latestQuery.startDttm > LOCALSTORAGE_MAX_QUERY_AGE_MS
  ) {
    return (
      <StyledEmptyStateWrapper>
        <EmptyStateMedium
          title={t('Run a query to display results')}
          image="document.svg"
        />
      </StyledEmptyStateWrapper>
    );
  }

  if (
    isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) &&
    latestQuery.state === 'success' &&
    !latestQuery.resultsKey &&
    !latestQuery.results
  ) {
    return (
      <Alert
        type="warning"
        message={t('No stored results found, you need to re-run your query')}
      />
    );
  }

  return (
    <ResultSet
      search
      queryId={latestQuery.id}
      height={height + EXTRA_HEIGHT_RESULTS}
      database={databases[latestQuery.dbId]}
      displayLimit={displayLimit}
      defaultQueryLimit={defaultQueryLimit}
      showSql
      showSqlInline
    />
  );
};

export default Results;
