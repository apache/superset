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
import { EditableTabs } from 'src/components/Tabs';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import URI from 'urijs';
import { FeatureFlag, styled, t } from '@superset-ui/core';
import { isFeatureEnabled } from 'src/featureFlags';
import { Tooltip } from 'src/components/Tooltip';
import { detectOS } from 'src/utils/common';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import { EmptyStateBig } from 'src/components/EmptyState';
import getBootstrapData from 'src/utils/getBootstrapData';
import SqlEditor from '../SqlEditor';
import SqlEditorTabHeader from '../SqlEditorTabHeader';

const propTypes = {
  actions: PropTypes.object.isRequired,
  defaultDbId: PropTypes.number,
  displayLimit: PropTypes.number,
  defaultQueryLimit: PropTypes.number.isRequired,
  maxRow: PropTypes.number.isRequired,
  databases: PropTypes.object.isRequired,
  queries: PropTypes.object.isRequired,
  queryEditors: PropTypes.array,
  tabHistory: PropTypes.array.isRequired,
  tables: PropTypes.array.isRequired,
  offline: PropTypes.bool,
  saveQueryWarning: PropTypes.string,
  scheduleQueryWarning: PropTypes.string,
};
const defaultProps = {
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
    };
    this.removeQueryEditor = this.removeQueryEditor.bind(this);
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
    // Hack: this data should be coming from getInitialState
    // but for some reason this data isn't being passed properly through
    // the reducer.
    const bootstrapData = getBootstrapData();
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
          name: query.name,
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

  popNewTab() {
    // Clean the url in browser history
    window.history.replaceState({}, document.title, this.state.sqlLabUrl);
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

  handleSelect(key) {
    const qeid = this.props.tabHistory[this.props.tabHistory.length - 1];
    if (key !== qeid) {
      const queryEditor = this.props.queryEditors.find(qe => qe.id === key);
      if (!queryEditor) {
        return;
      }
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

  duplicateQueryEditor(qe) {
    this.props.actions.cloneQueryToNewTab(qe, false);
  }

  render() {
    const noQueryEditors = this.props.queryEditors?.length === 0;
    const editors = this.props.queryEditors?.map(qe => (
      <EditableTabs.TabPane
        key={qe.id}
        tab={<SqlEditorTabHeader queryEditor={qe} />}
        // for tests - key prop isn't handled by enzyme well bcs it's a react keyword
        data-key={qe.id}
      >
        <SqlEditor
          tables={this.props.tables.filter(xt => xt.queryEditorId === qe.id)}
          queryEditor={qe}
          defaultQueryLimit={this.props.defaultQueryLimit}
          maxRow={this.props.maxRow}
          displayLimit={this.props.displayLimit}
          saveQueryWarning={this.props.saveQueryWarning}
          scheduleQueryWarning={this.props.scheduleQueryWarning}
        />
      </EditableTabs.TabPane>
    ));

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
          <i data-test="add-tab-icon" className="fa fa-plus-circle" />
        </Tooltip>
      </StyledTab>
    );

    const emptyTabState = (
      <EditableTabs.TabPane
        key={0}
        data-key={0}
        tab={emptyTab}
        closable={false}
      >
        <EmptyStateBig
          image="empty_sql_chart.svg"
          description={t('Add a new tab to create SQL Query')}
        />
      </EditableTabs.TabPane>
    );

    return (
      <StyledEditableTabs
        destroyInactiveTabPane
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        id="a11y-query-editor-tabs"
        className="SqlEditorTabs"
        data-test="sql-editor-tabs"
        onChange={this.handleSelect}
        fullWidth={false}
        hideAdd={this.props.offline}
        onTabClick={() => noQueryEditors && this.newQueryEditor()}
        onEdit={this.handleEdit}
        type={noQueryEditors ? 'card' : 'editable-card'}
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
        {noQueryEditors && emptyTabState}
      </StyledEditableTabs>
    );
  }
}
TabbedSqlEditors.propTypes = propTypes;
TabbedSqlEditors.defaultProps = defaultProps;

function mapStateToProps({ sqlLab, common }) {
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
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(TabbedSqlEditors);
