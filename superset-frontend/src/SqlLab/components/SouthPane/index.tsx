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
import { createRef, useCallback, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { nanoid } from 'nanoid';
import Tabs from 'src/components/Tabs';
import { css, styled, t } from '@superset-ui/core';

import { removeTables, setActiveSouthPaneTab } from 'src/SqlLab/actions/sqlLab';

import Label from 'src/components/Label';
import Icons from 'src/components/Icons';
import { SqlLabRootState } from 'src/SqlLab/types';
import QueryHistory from '../QueryHistory';
import {
  STATUS_OPTIONS,
  STATE_TYPE_MAP,
  STATUS_OPTIONS_LOCALIZED,
} from '../../constants';
import Results from './Results';
import TablePreview from '../TablePreview';

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
  const activeSouthPaneTab =
    useSelector<SqlLabRootState, string>(
      state => state.sqlLab.activeSouthPaneTab as string,
    ) ?? 'Results';

  const pinnedTables = useMemo(
    () =>
      tables.filter(
        ({ queryEditorId: qeId }) => String(queryEditorId) === qeId,
      ),
    [queryEditorId, tables],
  );
  const pinnedTableKeys = useMemo(
    () =>
      Object.fromEntries(
        pinnedTables.map(({ id, dbId, catalog, schema, name }) => [
          id,
          [dbId, catalog, schema, name].join(':'),
        ]),
      ),
    [pinnedTables],
  );
  const innerTabContentHeight = height - TAB_HEIGHT;
  const southPaneRef = createRef<HTMLDivElement>();
  const switchTab = (id: string) => {
    dispatch(setActiveSouthPaneTab(id));
  };
  const removeTable = useCallback(
    (key, action) => {
      if (action === 'remove') {
        const table = pinnedTables.find(
          ({ dbId, catalog, schema, name }) =>
            [dbId, catalog, schema, name].join(':') === key,
        );
        dispatch(removeTables([table]));
      }
    },
    [dispatch, pinnedTables],
  );

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
        type="editable-card"
        activeKey={pinnedTableKeys[activeSouthPaneTab] || activeSouthPaneTab}
        className="SouthPaneTabs"
        onChange={switchTab}
        id={nanoid(11)}
        fullWidth={false}
        animated={false}
        onEdit={removeTable}
        hideAdd
      >
        <Tabs.TabPane tab={t('Results')} key="Results" closable={false}>
          <Results
            height={innerTabContentHeight}
            latestQueryId={latestQueryId}
            displayLimit={displayLimit}
            defaultQueryLimit={defaultQueryLimit}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('Query history')} key="History" closable={false}>
          <QueryHistory
            queryEditorId={queryEditorId}
            displayLimit={displayLimit}
            latestQueryId={latestQueryId}
          />
        </Tabs.TabPane>
        {pinnedTables.map(({ id, dbId, catalog, schema, name }) => (
          <Tabs.TabPane
            tab={
              <>
                <Icons.Table
                  iconSize="s"
                  css={css`
                    margin-bottom: 2px;
                    margin-right: 4px;
                  `}
                />
                {`${schema}.${decodeURIComponent(name)}`}
              </>
            }
            key={pinnedTableKeys[id]}
          >
            <TablePreview
              dbId={dbId}
              catalog={catalog}
              schema={schema}
              tableName={name}
            />
          </Tabs.TabPane>
        ))}
      </Tabs>
    </StyledPane>
  );
};

export default SouthPane;
