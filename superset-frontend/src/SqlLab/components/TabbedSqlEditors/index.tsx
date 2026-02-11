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
import { PureComponent } from 'react';
import { EditableTabs } from '@superset-ui/core/components/Tabs';
import { connect } from 'react-redux';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { t } from '@apache-superset/core';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { Logger } from 'src/logger/LogUtils';
import { EmptyState, Tooltip } from '@superset-ui/core/components';
import { detectOS } from 'src/utils/common';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import { Icons } from '@superset-ui/core/components/Icons';
import SqlEditor from '../SqlEditor';
import SqlEditorTabHeader from '../SqlEditorTabHeader';

const DEFAULT_PROPS = {
  queryEditors: [],
  offline: false,
  saveQueryWarning: null,
  scheduleQueryWarning: null,
};

const StyledEditableTabs = styled(EditableTabs)`
  height: 100%;
  display: flex;
  flex-direction: column;
  & .ant-tabs-nav::before {
    border-color: ${({ theme }) => theme.colorBorder} !important;
  }
  & .ant-tabs-nav-add {
    border-color: ${({ theme }) => theme.colorBorder} !important;
    height: 34px;
  }
  & .ant-tabs-nav-list {
    align-items: end;
    padding-top: 1px;
    column-gap: ${({ theme }) => theme.sizeUnit}px;
  }
  & .ant-tabs-tab-active {
    border-left-color: ${({ theme }) => theme.colorPrimaryActive} !important;
    border-top-color: ${({ theme }) => theme.colorPrimaryActive} !important;
    border-right-color: ${({ theme }) => theme.colorPrimaryActive} !important;
    box-shadow: 0 0 2px ${({ theme }) => theme.colorPrimaryActive} !important;
    border-top: 2px;
  }
  & .ant-tabs-tab {
    border-radius: 2px 2px 0px 0px !important;
    padding: ${({ theme }) => theme.sizeUnit}px
      ${({ theme }) => theme.sizeUnit * 2}px !important;
    & + .ant-tabs-nav-add {
      margin-right: ${({ theme }) => theme.sizeUnit * 4}px;
    }
    &:not(.ant-tabs-tab-active) {
      border-color: ${({ theme }) => theme.colorBorder} !important;
      box-shadow: inset 0 0 1px ${({ theme }) => theme.colorBorder} !important;
    }
  }
  & .ant-tabs-nav-add {
    border-radius: 2px 2px 0px 0px !important;
    min-height: auto !important;
    align-self: flex-end;
  }
`;

const StyledTab = styled.span`
  line-height: 24px;
`;

const TabTitle = styled.span`
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
  text-transform: none;
`;

// Get the user's OS
const userOS = detectOS();

type TabbedSqlEditorsProps = ReturnType<typeof mergeProps>;

class TabbedSqlEditors extends PureComponent<TabbedSqlEditorsProps> {
  constructor(props: TabbedSqlEditorsProps) {
    super(props);
    this.removeQueryEditor = this.removeQueryEditor.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
  }

  componentDidMount() {
    const qe = this.activeQueryEditor();
    const latestQuery = this.props.queries[qe?.latestQueryId || ''];
    if (
      isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
      latestQuery?.resultsKey
    ) {
      // when results are not stored in localStorage they need to be
      // fetched from the results backend (if configured)
      this.props.actions.fetchQueryResults(
        latestQuery,
        this.props.displayLimit,
      );
    }
  }

  activeQueryEditor() {
    if (this.props.tabHistory.length === 0) {
      return this.props.queryEditors[0];
    }
    const qeid = this.props.tabHistory[this.props.tabHistory.length - 1];
    return this.props.queryEditors.find(qe => qe.id === qeid) || null;
  }

  newQueryEditor() {
    this.props.actions.addNewQueryEditor();
  }

  handleSelect(key: string) {
    const qeid = this.props.tabHistory[this.props.tabHistory.length - 1];
    if (key !== qeid) {
      const queryEditor = this.props.queryEditors.find(qe => qe.id === key);
      if (!queryEditor) {
        return;
      }
      this.props.actions.setActiveQueryEditor(queryEditor);
    }
  }

  handleEdit(key: string, action: string) {
    if (action === 'remove') {
      const qe = this.props.queryEditors.find(qe => qe.id === key);
      if (qe) {
        this.removeQueryEditor(qe);
      }
    }
    if (action === 'add') {
      Logger.markTimeOrigin();
      this.newQueryEditor();
    }
  }

  removeQueryEditor(qe: QueryEditor) {
    this.props.actions.removeQueryEditor(qe);
  }

  onTabClicked = () => {
    Logger.markTimeOrigin();
    const noQueryEditors = this.props.queryEditors?.length === 0;
    if (noQueryEditors) {
      this.newQueryEditor();
    }
  };

  render() {
    const editors = this.props.queryEditors?.map(qe => ({
      key: qe.id,
      label: <SqlEditorTabHeader queryEditor={qe} />,
      children: (
        <SqlEditor
          queryEditor={qe}
          defaultQueryLimit={this.props.defaultQueryLimit}
          maxRow={this.props.maxRow}
          displayLimit={this.props.displayLimit}
          saveQueryWarning={this.props.saveQueryWarning}
          scheduleQueryWarning={this.props.scheduleQueryWarning}
        />
      ),
    }));

    const emptyTab = (
      <StyledTab>
        <TabTitle>{t('Add a new tab')}</TabTitle>
        <Tooltip
          id="add-tab"
          placement="bottom"
          title={
            userOS === 'Windows'
              ? t('New tab (Ctrl + q)')
              : t('New tab (Ctrl + t)')
          }
        >
          <span
            css={css`
              display: inline-flex;
              vertical-align: middle;
            `}
          >
            <Icons.PlusCircleOutlined iconSize="s" data-test="add-tab-icon" />
          </span>
        </Tooltip>
      </StyledTab>
    );

    const emptyTabState = {
      key: '0',
      label: emptyTab,
      children: (
        <EmptyState
          image="empty_sql_chart.svg"
          size="large"
          description={t('Add a new tab to create SQL Query')}
        />
      ),
    };

    const tabItems =
      this.props.queryEditors?.length > 0 ? editors : [emptyTabState];

    return (
      <StyledEditableTabs
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        id="a11y-query-editor-tabs"
        className="SqlEditorTabs"
        data-test="sql-editor-tabs"
        onChange={this.handleSelect}
        hideAdd={this.props.offline}
        onTabClick={this.onTabClicked}
        onEdit={this.handleEdit}
        type={this.props.queryEditors?.length === 0 ? 'card' : 'editable-card'}
        addIcon={
          <Tooltip
            id="add-tab"
            placement="left"
            title={
              userOS === 'Windows'
                ? t('New tab (Ctrl + q)')
                : t('New tab (Ctrl + t)')
            }
          >
            <span
              css={css`
                display: inline-flex;
                vertical-align: middle;
              `}
            >
              <Icons.PlusOutlined iconSize="l" data-test="add-tab-icon" />
            </span>
          </Tooltip>
        }
        items={tabItems}
      />
    );
  }
}

export function mapStateToProps({ sqlLab, common }: SqlLabRootState) {
  return {
    queryEditors: sqlLab.queryEditors ?? DEFAULT_PROPS.queryEditors,
    queries: sqlLab.queries,
    tabHistory: sqlLab.tabHistory,
    defaultDbId: common.conf.SQLLAB_DEFAULT_DBID,
    displayLimit: common.conf.DISPLAY_MAX_ROW,
    offline: sqlLab.offline ?? DEFAULT_PROPS.offline,
    defaultQueryLimit: common.conf.DEFAULT_SQLLAB_LIMIT,
    maxRow: common.conf.SQL_MAX_ROW,
    saveQueryWarning:
      common.conf.SQLLAB_SAVE_WARNING_MESSAGE ?? DEFAULT_PROPS.saveQueryWarning,
    scheduleQueryWarning:
      common.conf.SQLLAB_SCHEDULE_WARNING_MESSAGE ??
      DEFAULT_PROPS.scheduleQueryWarning,
  };
}

const mapDispatchToProps = {
  ...Actions,
};

function mergeProps(
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: typeof mapDispatchToProps,
) {
  return {
    ...stateProps,
    actions: dispatchProps,
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
)(TabbedSqlEditors);
