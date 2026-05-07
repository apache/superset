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
import Tabs from '@superset-ui/core/components/Tabs';
import { css, styled, t, useTheme } from '@superset-ui/core';

import { removeTables, setActiveSouthPaneTab } from 'src/SqlLab/actions/sqlLab';

import { Label } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { SqlLabRootState } from 'src/SqlLab/types';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
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

const TABS_KEYS = {
  RESULTS: 'Results',
  HISTORY: 'History',
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
      margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
    }

    button.fetch {
      margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
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
  const { id, tabViewId } = useQueryEditor(queryEditorId, ['tabViewId']);
  const editorId = tabViewId ?? id;
  const theme = useTheme();
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
    () => tables.filter(({ queryEditorId: qeId }) => String(editorId) === qeId),
    [editorId, tables],
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

  if (offline) {
    return (
      <Label type={STATE_TYPE_MAP[STATUS_OPTIONS.offline]}>
        {STATUS_OPTIONS_LOCALIZED.offline}
      </Label>
    );
  }

  const tabItems = [
    {
      key: TABS_KEYS.RESULTS,
      label: t('Results'),
      children: (
        <Results
          height={innerTabContentHeight}
          latestQueryId={latestQueryId}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
        />
      ),
      closable: false,
    },
    {
      key: TABS_KEYS.HISTORY,
      label: t('Query history'),
      children: (
        <QueryHistory
          queryEditorId={queryEditorId}
          displayLimit={displayLimit}
          latestQueryId={latestQueryId}
        />
      ),
      closable: false,
    },
    ...pinnedTables.map(({ id, dbId, catalog, schema, name }) => ({
      key: pinnedTableKeys[id],
      label: (
        <>
          <Icons.InsertRowAboveOutlined
            iconSize="l"
            css={css`
              margin-bottom: ${theme.sizeUnit * 0.5}px;
              margin-right: ${theme.sizeUnit}px;
            `}
          />
          {`${schema}.${decodeURIComponent(name)}`}
        </>
      ),
      children: (
        <TablePreview
          dbId={dbId}
          catalog={catalog}
          schema={schema}
          tableName={name}
        />
      ),
    })),
  ];

  return (
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
        animated={false}
        onEdit={removeTable}
        hideAdd
        items={tabItems}
      />
    </StyledPane>
  );
};

export default SouthPane;
