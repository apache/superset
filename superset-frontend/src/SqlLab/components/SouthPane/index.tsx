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
import Tabs from 'src/components/Tabs';
import { styled, t } from '@superset-ui/core';

import { setActiveSouthPaneTab } from 'src/SqlLab/actions/sqlLab';

import Label from 'src/components/Label';
import { SqlLabRootState } from 'src/SqlLab/types';
import QueryHistory from '../QueryHistory';
import ResultSet from '../ResultSet';
import {
  STATUS_OPTIONS,
  STATE_TYPE_MAP,
  STATUS_OPTIONS_LOCALIZED,
} from '../../constants';
import Results from './Results';

const TAB_HEIGHT = 130;

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

const SouthPane = ({
  queryEditorId,
  latestQueryId,
  height,
  displayLimit,
  defaultQueryLimit,
}: SouthPaneProps) => {
  const dispatch = useDispatch();
  const { offline, tables } = useSelector(
    ({ sqlLab: { offline, tables } }: SqlLabRootState) => ({
      offline,
      tables,
    }),
    shallowEqual,
  );
  const queries = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) => Object.keys(queries),
    shallowEqual,
  );
  const activeSouthPaneTab =
    useSelector<SqlLabRootState, string>(
      state => state.sqlLab.activeSouthPaneTab as string,
    ) ?? 'Results';

  const querySet = useMemo(() => new Set(queries), [queries]);
  const dataPreviewQueries = useMemo(
    () =>
      tables.filter(
        ({ dataPreviewQueryId, queryEditorId: qeId }) =>
          dataPreviewQueryId &&
          queryEditorId === qeId &&
          querySet.has(dataPreviewQueryId),
      ),
    [queryEditorId, tables, querySet],
  );
  const innerTabContentHeight = height - TAB_HEIGHT;
  const southPaneRef = createRef<HTMLDivElement>();
  const switchTab = (id: string) => {
    dispatch(setActiveSouthPaneTab(id));
  };

  return offline ? (
    <Label className="m-r-3" type={STATE_TYPE_MAP[STATUS_OPTIONS.offline]}>
      {STATUS_OPTIONS_LOCALIZED.offline}
    </Label>
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
          {latestQueryId && (
            <Results
              height={innerTabContentHeight}
              latestQueryId={latestQueryId}
              displayLimit={displayLimit}
              defaultQueryLimit={defaultQueryLimit}
            />
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Query history')} key="History">
          <QueryHistory
            queryEditorId={queryEditorId}
            displayLimit={displayLimit}
            latestQueryId={latestQueryId}
          />
        </Tabs.TabPane>
        {dataPreviewQueries.map(
          ({ name, dataPreviewQueryId }) =>
            dataPreviewQueryId && (
              <Tabs.TabPane
                tab={t('Preview: `%s`', decodeURIComponent(name))}
                key={dataPreviewQueryId}
              >
                <ResultSet
                  queryId={dataPreviewQueryId}
                  visualize={false}
                  csv={false}
                  cache
                  height={innerTabContentHeight}
                  displayLimit={displayLimit}
                  defaultQueryLimit={defaultQueryLimit}
                />
              </Tabs.TabPane>
            ),
        )}
      </Tabs>
    </StyledPane>
  );
};

export default SouthPane;
