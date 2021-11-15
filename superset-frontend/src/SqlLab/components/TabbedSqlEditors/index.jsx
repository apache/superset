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
import PropTypes from 'prop-types';
import { Dropdown } from 'src/components/Dropdown';
import { EditableTabs } from 'src/components/Tabs';
import { Menu } from 'src/common/components';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import URI from 'urijs';
import { styled, t } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import { areArraysShallowEqual } from 'src/reduxUtils';
import { Tooltip } from 'src/components/Tooltip';
import { detectOS } from 'src/utils/common';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import SqlEditor from '../SqlEditor';
import TabStatusIcon from '../TabStatusIcon';

const propTypes = {
  actions: PropTypes.object.isRequired,
  defaultDbId: PropTypes.number,
  displayLimit: PropTypes.number,
  defaultQueryLimit: PropTypes.number.isRequired,
  maxRow: PropTypes.number.isRequired,
  databases: PropTypes.object.isRequired,
  queries: PropTypes.object.isRequired,
  queryEditors: PropTypes.array,
  requestedQuery: PropTypes.object,
  tabHistory: PropTypes.array.isRequired,
  tables: PropTypes.array.isRequired,
  offline: PropTypes.bool,
  saveQueryWarning: PropTypes.string,
  scheduleQueryWarning: PropTypes.string,
};
const defaultProps = {
  queryEditors: [],
  offline: false,
  requestedQuery: null,
  saveQueryWarning: null,
  scheduleQueryWarning: null,
};

let queryCount = 1;

const TabTitleWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const TabTitle = styled.span`
  margin-right: ${({ theme }) => theme.gridUnit * 2}px;
  text-transform: none;
`;

// Get the user's OS
const userOS = detectOS();

class TabbedSqlEditors extends React.PureComponent {
  constructor(props) {
    super(props);
    const sqlLabUrl = '/superset/sqllab';
    this.state = {
      sqlLabUrl,
      queriesArray: [],
      dataPreviewQueries: [],
    };
    this.removeQueryEditor = this.removeQueryEditor.bind(this);
    this.renameTab = this.renameTab.bind(this);
    this.toggleLeftBar = this.toggleLeftBar.bind(this);
    this.removeAllOtherQueryEditors = this.removeAllOtherQueryEditors.bind(
      this,
    );
    this.duplicateQueryEditor = this.duplicateQueryEditor.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
  }

  componentDidMount() {
    // migrate query editor and associated tables state to server
    if (isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)) {
      const localStorageTables = this.props.tables.filter(
        table => table.inLocalStorage,
      );
      const localStorageQueries = Object.values(this.props.queries).filter(
        query => query.inLocalStorage,
      );
      this.props.queryEditors
        .filter(qe => qe.inLocalStorage)
        .forEach(qe => {
          // get all queries associated with the query editor
          const queries = localStorageQueries.filter(
            query => query.sqlEditorId === qe.id,
          );
          const tables = localStorageTables.filter(
            table => table.queryEditorId === qe.id,
          );
          this.props.actions.migrateQueryEditorFromLocalStorage(
            qe,
            tables,
            queries,
          );
        });
    }

    // merge post form data with GET search params
    // Hack: this data should be comming from getInitialState
    // but for some reason this data isn't being passed properly through
    // the reducer.
    const appContainer = document.getElementById('app');
    const bootstrapData = JSON.parse(
      appContainer?.getAttribute('data-bootstrap') || '{}',
    );
    const query = {
      ...bootstrapData.requested_query,
      ...URI(window.location).search(true),
    };

    // Popping a new tab based on the querystring
    if (
      query.id ||
      query.sql ||
      query.savedQueryId ||
      query.datasourceKey ||
      query.queryId
    ) {
      if (query.id) {
        this.props.actions.popStoredQuery(query.id);
      } else if (query.savedQueryId) {
        this.props.actions.popSavedQuery(query.savedQueryId);
      } else if (query.queryId) {
        this.props.actions.popQuery(query.queryId);
      } else if (query.datasourceKey) {
        this.props.actions.popDatasourceQuery(query.datasourceKey, query.sql);
      } else if (query.sql) {
        let dbId = query.dbid;
        if (dbId) {
          dbId = parseInt(dbId, 10);
        } else {
          const { databases } = this.props;
          const dbName = query.dbname;
          if (dbName) {
            Object.keys(databases).forEach(db => {
              if (databases[db].database_name === dbName) {
                dbId = databases[db].id;
              }
            });
          }
        }
        const newQueryEditor = {
          title: query.title,
          dbId,
          schema: query.schema,
          autorun: query.autorun,
          sql: query.sql,
        };
        this.props.actions.addQueryEditor(newQueryEditor);
      }
      this.popNewTab();
    } else if (query.new || this.props.queryEditors.length === 0) {
      this.newQueryEditor();

      if (query.new) {
        window.history.replaceState({}, document.title, this.state.sqlLabUrl);
      }
    } else {
      const qe = this.activeQueryEditor();
      const latestQuery = this.props.queries[qe.latestQueryId];
      if (
        isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE) &&
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

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextActiveQeId =
      nextProps.tabHistory[nextProps.tabHistory.length - 1];
    const queriesArray = Object.values(nextProps.queries).filter(
      query => query.sqlEditorId === nextActiveQeId,
    );
    if (!areArraysShallowEqual(queriesArray, this.state.queriesArray)) {
      this.setState({ queriesArray });
    }

    const dataPreviewQueries = [];
    nextProps.tables.forEach(table => {
      const queryId = table.dataPreviewQueryId;
      if (
        queryId &&
        nextProps.queries[queryId] &&
        table.queryEditorId === nextActiveQeId
      ) {
        dataPreviewQueries.push({
          ...nextProps.queries[queryId],
          tableName: table.name,
        });
      }
    });
    if (
      !areArraysShallowEqual(dataPreviewQueries, this.state.dataPreviewQueries)
    ) {
      this.setState({ dataPreviewQueries });
    }
  }

  popNewTab() {
    queryCount += 1;
    // Clean the url in browser history
    window.history.replaceState({}, document.title, this.state.sqlLabUrl);
  }

  renameTab(qe) {
    /* eslint no-alert: 0 */
    const newTitle = prompt(t('Enter a new title for the tab'));
    if (newTitle) {
      this.props.actions.queryEditorSetTitle(qe, newTitle);
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
    queryCount += 1;
    const activeQueryEditor = this.activeQueryEditor();
    const firstDbId = Math.min(
      ...Object.values(this.props.databases).map(database => database.id),
    );
    const warning = isFeatureEnabled(FeatureFlag.SQLLAB_BACKEND_PERSISTENCE)
      ? ''
      : `${t(
          '-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.',
        )}\n\n`;
    const qe = {
      title: t('Untitled Query %s', queryCount),
      dbId:
        activeQueryEditor && activeQueryEditor.dbId
          ? activeQueryEditor.dbId
          : this.props.defaultDbId || firstDbId,
      schema: activeQueryEditor ? activeQueryEditor.schema : null,
      autorun: false,
      sql: `${warning}SELECT ...`,
      queryLimit: this.props.defaultQueryLimit,
    };
    this.props.actions.addQueryEditor(qe);
  }

  handleSelect(key) {
    const qeid = this.props.tabHistory[this.props.tabHistory.length - 1];
    if (key !== qeid) {
      const queryEditor = this.props.queryEditors.find(qe => qe.id === key);
      this.props.actions.switchQueryEditor(
        queryEditor,
        this.props.displayLimit,
      );
    }
  }

  handleEdit(key, action) {
    if (action === 'remove') {
      const qe = this.props.queryEditors.find(qe => qe.id === key);
      this.removeQueryEditor(qe);
    }
    if (action === 'add') {
      this.newQueryEditor();
    }
  }

  removeQueryEditor(qe) {
    this.props.actions.removeQueryEditor(qe);
  }

  removeAllOtherQueryEditors(cqe) {
    this.props.queryEditors.forEach(
      qe => qe !== cqe && this.removeQueryEditor(qe),
    );
  }

  duplicateQueryEditor(qe) {
    this.props.actions.cloneQueryToNewTab(qe, false);
  }

  toggleLeftBar(qe) {
    this.props.actions.toggleLeftBar(qe);
  }

  render() {
    const editors = this.props.queryEditors.map(qe => {
      let latestQuery;
      if (qe.latestQueryId) {
        latestQuery = this.props.queries[qe.latestQueryId];
      }
      let database;
      if (qe.dbId) {
        database = this.props.databases[qe.dbId];
      }
      const state = latestQuery ? latestQuery.state : '';

      const menu = (
        <Menu style={{ width: 176 }}>
          <Menu.Item
            className="close-btn"
            key="1"
            onClick={() => this.removeQueryEditor(qe)}
            data-test="close-tab-menu-option"
          >
            <div className="icon-container">
              <i className="fa fa-close" />
            </div>
            {t('Close tab')}
          </Menu.Item>
          <Menu.Item key="2" onClick={() => this.renameTab(qe)}>
            <div className="icon-container">
              <i className="fa fa-i-cursor" />
            </div>
            {t('Rename tab')}
          </Menu.Item>
          <Menu.Item key="3" onClick={() => this.toggleLeftBar(qe)}>
            <div className="icon-container">
              <i className="fa fa-cogs" />
            </div>
            {qe.hideLeftBar ? t('Expand tool bar') : t('Hide tool bar')}
          </Menu.Item>
          <Menu.Item
            key="4"
            onClick={() => this.removeAllOtherQueryEditors(qe)}
          >
            <div className="icon-container">
              <i className="fa fa-times-circle-o" />
            </div>
            {t('Close all other tabs')}
          </Menu.Item>
          <Menu.Item key="5" onClick={() => this.duplicateQueryEditor(qe)}>
            <div className="icon-container">
              <i className="fa fa-files-o" />
            </div>
            {t('Duplicate tab')}
          </Menu.Item>
        </Menu>
      );
      const tabHeader = (
        <TabTitleWrapper>
          <div data-test="dropdown-toggle-button">
            <Dropdown overlay={menu} trigger={['click']} />
          </div>
          <TabTitle>{qe.title}</TabTitle> <TabStatusIcon tabState={state} />{' '}
        </TabTitleWrapper>
      );
      return (
        <EditableTabs.TabPane
          key={qe.id}
          tab={tabHeader}
          // for tests - key prop isn't handled by enzyme well bcs it's a react keyword
          data-key={qe.id}
        >
          <SqlEditor
            tables={this.props.tables.filter(xt => xt.queryEditorId === qe.id)}
            queryEditorId={qe.id}
            editorQueries={this.state.queriesArray}
            dataPreviewQueries={this.state.dataPreviewQueries}
            latestQuery={latestQuery}
            database={database}
            actions={this.props.actions}
            hideLeftBar={qe.hideLeftBar}
            defaultQueryLimit={this.props.defaultQueryLimit}
            maxRow={this.props.maxRow}
            displayLimit={this.props.displayLimit}
            saveQueryWarning={this.props.saveQueryWarning}
            scheduleQueryWarning={this.props.scheduleQueryWarning}
          />
        </EditableTabs.TabPane>
      );
    });

    return (
      <EditableTabs
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        id="a11y-query-editor-tabs"
        className="SqlEditorTabs"
        data-test="sql-editor-tabs"
        onChange={this.handleSelect}
        fullWidth={false}
        hideAdd={this.props.offline}
        onEdit={this.handleEdit}
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
            <i data-test="add-tab-icon" className="fa fa-plus-circle" />
          </Tooltip>
        }
      >
        {editors}
      </EditableTabs>
    );
  }
}
TabbedSqlEditors.propTypes = propTypes;
TabbedSqlEditors.defaultProps = defaultProps;

function mapStateToProps({ sqlLab, common, requestedQuery }) {
  return {
    databases: sqlLab.databases,
    queryEditors: sqlLab.queryEditors,
    queries: sqlLab.queries,
    tabHistory: sqlLab.tabHistory,
    tables: sqlLab.tables,
    defaultDbId: sqlLab.defaultDbId,
    displayLimit: common.conf.DISPLAY_MAX_ROW,
    offline: sqlLab.offline,
    defaultQueryLimit: common.conf.DEFAULT_SQLLAB_LIMIT,
    maxRow: common.conf.SQL_MAX_ROW,
    saveQueryWarning: common.conf.SQLLAB_SAVE_WARNING_MESSAGE,
    scheduleQueryWarning: common.conf.SQLLAB_SCHEDULE_WARNING_MESSAGE,
    requestedQuery,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(TabbedSqlEditors);
