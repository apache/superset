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
import { pick } from 'lodash';
import { EditableTabs } from '@superset-ui/core/components/Tabs';
import { connect } from 'react-redux';
import URI from 'urijs';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import {
  FeatureFlag,
  styled,
  t,
  isFeatureEnabled,
  css,
} from '@superset-ui/core';
import { Logger } from 'src/logger/LogUtils';
import { EmptyState, Tooltip } from '@superset-ui/core/components';
import { detectOS } from 'src/utils/common';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import getBootstrapData from 'src/utils/getBootstrapData';
import { locationContext } from 'src/pages/SqlLab/LocationContext';
import { navigateWithState } from 'src/utils/navigationUtils';
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

const SQL_LAB_URL = '/sqllab';

class TabbedSqlEditors extends PureComponent<TabbedSqlEditorsProps> {
  constructor(props: TabbedSqlEditorsProps) {
    super(props);
    this.removeQueryEditor = this.removeQueryEditor.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
  }

  componentDidMount() {
    // merge post form data with GET search params
    // Hack: this data should be coming from getInitialState
    // but for some reason this data isn't being passed properly through
    // the reducer.
    const bootstrapData = getBootstrapData();
    const queryParameters = URI(window.location).search(true);
    const path = URI(window.location).path();
    const {
      id,
      name,
      sql,
      savedQueryId,
      datasourceKey,
      queryId,
      dbid,
      dbname,
      catalog,
      schema,
      autorun,
      new: isNewQuery,
      ...urlParams
    } = {
      ...this.context.requestedQuery,
      ...bootstrapData.requested_query,
      ...queryParameters,
    } as Record<string, string>;
    const permalink = path.match(/\/p\/\w+/)?.[0].slice(3);

    // Popping a new tab based on the querystring
    if (permalink || id || sql || savedQueryId || datasourceKey || queryId) {
      if (permalink) {
        this.props.actions.popPermalink(permalink);
      } else if (id) {
        this.props.actions.popStoredQuery(id);
      } else if (savedQueryId) {
        this.props.actions.popSavedQuery(savedQueryId);
      } else if (queryId) {
        this.props.actions.popQuery(queryId);
      } else if (datasourceKey) {
        this.props.actions.popDatasourceQuery(datasourceKey, sql);
      } else if (sql) {
        let databaseId: string | number = dbid;
        if (databaseId) {
          databaseId = parseInt(databaseId, 10);
        } else {
          const { databases } = this.props;
          const databaseName = dbname;
          if (databaseName) {
            Object.keys(databases).forEach(db => {
              if (databases[db].database_name === databaseName) {
                databaseId = databases[db].id;
              }
            });
          }
        }
        const newQueryEditor = {
          name,
          dbId: databaseId,
          catalog,
          schema,
          autorun,
          sql,
          isDataset: this.context.isDataset,
        };
        this.props.actions.addQueryEditor(newQueryEditor);
      }
      this.popNewTab(pick(urlParams, Object.keys(queryParameters ?? {})));
    } else if (isNewQuery || this.props.queryEditors.length === 0) {
      this.newQueryEditor();

      if (isNewQuery) {
        navigateWithState(SQL_LAB_URL, {}, { replace: true });
      }
    } else {
      const qe = this.activeQueryEditor();
      const latestQuery = this.props.queries[qe?.latestQueryId || ''];
      if (
        isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
        latestQuery &&
        latestQuery.resultsKey
      ) {
        // when results are not stored in localStorage they need to be
        // fetched from the results backend (if configured)
        this.props.actions.fetchQueryResults(
          latestQuery,
          this.props.displayLimit,
        );
      }
    }
  }

  popNewTab(urlParams: Record<string, string>) {
    // Clean the url in browser history
    const updatedUrl = `${URI(SQL_LAB_URL).query(urlParams)}`;
    navigateWithState(updatedUrl, {}, { replace: true });
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
          <Icons.PlusCircleOutlined
            iconSize="s"
            css={css`
              vertical-align: middle;
            `}
            data-test="add-tab-icon"
          />
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
            placement="bottom"
            title={
              userOS === 'Windows'
                ? t('New tab (Ctrl + q)')
                : t('New tab (Ctrl + t)')
            }
          >
            <Icons.PlusCircleOutlined
              iconSize="l"
              css={css`
                vertical-align: middle;
              `}
              data-test="add-tab-icon"
            />
          </Tooltip>
        }
        items={tabItems}
      />
    );
  }
}

TabbedSqlEditors.contextType = locationContext;

export function mapStateToProps({ sqlLab, common }: SqlLabRootState) {
  return {
    databases: sqlLab.databases,
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
