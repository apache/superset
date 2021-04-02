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
import React, { createRef } from 'react';
import shortid from 'shortid';
import Alert from 'src/components/Alert';
import Tabs from 'src/common/components/Tabs';
import { t, styled } from '@superset-ui/core';

import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

import Label from 'src/components/Label';
import QueryHistory from '../QueryHistory';
import ResultSet from '../ResultSet';
import {
  STATUS_OPTIONS,
  STATE_TYPE_MAP,
  LOCALSTORAGE_MAX_QUERY_AGE_MS,
} from '../../constants';

const TAB_HEIGHT = 90;

/*
    editorQueries are queries executed by users passed from SqlEditor component
    dataPrebiewQueries are all queries executed for preview of table data (from SqlEditorLeft)
*/
interface SouthPanePropTypes {
  editorQueries: any[];
  latestQueryId?: string;
  dataPreviewQueries: any[];
  actions: Record<string, Function>;
  activeSouthPaneTab?: string;
  height: number;
  databases: Record<string, any>;
  offline?: boolean;
  displayLimit: number;
}

const StyledPane = styled.div`
  width: 100%;

  .ant-tabs .ant-tabs-content-holder {
    overflow: visible;
  }
  .SouthPaneTabs {
    height: 100%;
    display: flex;
    flex-direction: column;
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

export default function SouthPane({
  editorQueries,
  latestQueryId,
  dataPreviewQueries,
  actions,
  activeSouthPaneTab = 'Results',
  height,
  databases,
  offline = false,
  displayLimit,
}: SouthPanePropTypes) {
  const innerTabContentHeight = height - TAB_HEIGHT;
  const southPaneRef = createRef<HTMLDivElement>();
  const switchTab = (id: string) => {
    actions.setActiveSouthPaneTab(id);
  };

  const renderOfflineStatus = () => (
    <Label className="m-r-3" type={STATE_TYPE_MAP[STATUS_OPTIONS.offline]}>
      {STATUS_OPTIONS.offline}
    </Label>
  );

  const renderResults = () => {
    let latestQuery;
    if (editorQueries.length > 0) {
      // get the latest query
      latestQuery = editorQueries.find(({ id }) => id === latestQueryId);
    }
    let results;
    if (latestQuery) {
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
            showControls
            search
            query={latestQuery}
            actions={actions}
            height={innerTabContentHeight}
            database={databases[latestQuery.dbId]}
            displayLimit={displayLimit}
          />
        );
      }
    } else {
      results = (
        <Alert type="info" message={t('Run a query to display results here')} />
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
          actions={actions}
          cache
          height={innerTabContentHeight}
          displayLimit={displayLimit}
        />
      </Tabs.TabPane>
    ));
  return offline ? (
    renderOfflineStatus()
  ) : (
    <StyledPane className="SouthPane" ref={southPaneRef}>
      <Tabs
        activeKey={activeSouthPaneTab}
        className="SouthPaneTabs"
        onChange={switchTab}
        id={shortid.generate()}
        fullWidth={false}
      >
        <Tabs.TabPane tab={t('Results')} key="Results">
          {renderResults()}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Query history')} key="History">
          <QueryHistory
            queries={editorQueries}
            actions={actions}
            displayLimit={displayLimit}
          />
        </Tabs.TabPane>
        {renderDataPreviewTabs()}
      </Tabs>
    </StyledPane>
  );
}
