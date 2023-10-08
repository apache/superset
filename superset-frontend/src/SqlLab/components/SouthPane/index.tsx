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
import React, { createRef, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import shortid from 'shortid';
import Alert from 'src/components/Alert';
import Tabs from 'src/components/Tabs';
import { EmptyStateMedium } from 'src/components/EmptyState';
import { FeatureFlag, styled, t, isFeatureEnabled } from '@superset-ui/core';

import { setActiveSouthPaneTab } from 'src/SqlLab/actions/sqlLab';

import Label from 'src/components/Label';
import { SqlLabRootState } from 'src/SqlLab/types';
import QueryHistory from '../QueryHistory';
import ResultSet from '../ResultSet';
import {
  STATUS_OPTIONS,
  STATE_TYPE_MAP,
  LOCALSTORAGE_MAX_QUERY_AGE_MS,
  STATUS_OPTIONS_LOCALIZED,
} from '../../constants';

const TAB_HEIGHT = 140;

/*
    editorQueries are queries executed by users passed from SqlEditor component
    dataPreviewQueries are all queries executed for preview of table data (from SqlEditorLeft)
*/
export interface SouthPaneProps {
  queryEditorId: string;
  latestQueryId?: string;
  height: number;
  displayLimit: number;
  defaultQueryLimit: number;
}

type StyledPaneProps = {
  height: number;
};

const StyledPane = styled.div<StyledPaneProps>`
  width: 100%;
  height: ${props => props.height}px;
  .ant-tabs .ant-tabs-content-holder {
    overflow: visible;
  }
  .SouthPaneTabs {
    height: 100%;
    display: flex;
    flex-direction: column;
    .scrollable {
      overflow-y: auto;
    }
  }
  .ant-tabs-tabpane {
    .scrollable {
      overflow-y: auto;
    }
  }
  .tab-content {
    .alert {
      margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    }

    button.fetch {
      margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
`;

const EXTRA_HEIGHT_RESULTS = 24; // we need extra height in RESULTS tab. because the height from props was calculated based on PREVIEW tab.
const StyledEmptyStateWrapper = styled.div`
  height: 100%;
  .ant-empty-image img {
    margin-right: 28px;
  }

  p {
    margin-right: 28px;
  }
`;

const SouthPane = ({
  queryEditorId,
  latestQueryId,
  height,
  displayLimit,
  defaultQueryLimit,
}: SouthPaneProps) => {
  const dispatch = useDispatch();
  const user = useSelector(({ user }: SqlLabRootState) => user, shallowEqual);
  const { databases, offline, queries, tables } = useSelector(
    ({ sqlLab: { databases, offline, queries, tables } }: SqlLabRootState) => ({
      databases,
      offline,
      queries,
      tables,
    }),
    shallowEqual,
  );
  const editorQueries = useMemo(
    () =>
      Object.values(queries).filter(
        ({ sqlEditorId }) => sqlEditorId === queryEditorId,
      ),
    [queries, queryEditorId],
  );
  const dataPreviewQueries = useMemo(
    () =>
      tables
        .filter(
          ({ dataPreviewQueryId, queryEditorId: qeId }) =>
            dataPreviewQueryId &&
            queryEditorId === qeId &&
            queries[dataPreviewQueryId],
        )
        .map(({ name, dataPreviewQueryId }) => ({
          ...queries[dataPreviewQueryId || ''],
          tableName: name,
        })),
    [queries, queryEditorId, tables],
  );
  const latestQuery = useMemo(
    () => editorQueries.find(({ id }) => id === latestQueryId),
    [editorQueries, latestQueryId],
  );

  const activeSouthPaneTab =
    useSelector<SqlLabRootState, string>(
      state => state.sqlLab.activeSouthPaneTab as string,
    ) ?? 'Results';
  const innerTabContentHeight = height - TAB_HEIGHT;
  const southPaneRef = createRef<HTMLDivElement>();
  const switchTab = (id: string) => {
    dispatch(setActiveSouthPaneTab(id));
  };
  const renderOfflineStatus = () => (
    <Label className="m-r-3" type={STATE_TYPE_MAP[STATUS_OPTIONS.offline]}>
      {STATUS_OPTIONS_LOCALIZED.offline}
    </Label>
  );

  const renderResults = () => {
    let results;
    if (latestQuery) {
      if (latestQuery?.extra?.errors) {
        latestQuery.errors = latestQuery.extra.errors;
      }
      if (
        isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) &&
        latestQuery.state === 'success' &&
        !latestQuery.resultsKey &&
        !latestQuery.results
      ) {
        results = (
          <Alert
            type="warning"
            message={t(
              'No stored results found, you need to re-run your query',
            )}
          />
        );
        return results;
      }
      if (Date.now() - latestQuery.startDttm <= LOCALSTORAGE_MAX_QUERY_AGE_MS) {
        results = (
          <ResultSet
            search
            query={latestQuery}
            user={user}
            height={innerTabContentHeight + EXTRA_HEIGHT_RESULTS}
            database={databases[latestQuery.dbId]}
            displayLimit={displayLimit}
            defaultQueryLimit={defaultQueryLimit}
            showSql
            showSqlInline
          />
        );
      }
    } else {
      results = (
        <StyledEmptyStateWrapper>
          <EmptyStateMedium
            title={t('Run a query to display results')}
            image="document.svg"
          />
        </StyledEmptyStateWrapper>
      );
    }
    return results;
  };

  const renderDataPreviewTabs = () =>
    dataPreviewQueries.map(query => (
      <Tabs.TabPane
        tab={t('Preview: `%s`', decodeURIComponent(query.tableName))}
        key={query.id}
      >
        <ResultSet
          query={query}
          visualize={false}
          csv={false}
          cache
          user={user}
          height={innerTabContentHeight}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
        />
      </Tabs.TabPane>
    ));
  return offline ? (
    renderOfflineStatus()
  ) : (
    <StyledPane
      data-test="south-pane"
      className="SouthPane"
      height={height}
      ref={southPaneRef}
    >
      <Tabs
        activeKey={activeSouthPaneTab}
        className="SouthPaneTabs"
        onChange={switchTab}
        id={shortid.generate()}
        fullWidth={false}
        animated={false}
      >
        <Tabs.TabPane tab={t('Results')} key="Results">
          {renderResults()}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Query history')} key="History">
          <QueryHistory
            queries={editorQueries}
            displayLimit={displayLimit}
            latestQueryId={latestQueryId}
          />
        </Tabs.TabPane>
        {renderDataPreviewTabs()}
      </Tabs>
    </StyledPane>
  );
};

export default SouthPane;
