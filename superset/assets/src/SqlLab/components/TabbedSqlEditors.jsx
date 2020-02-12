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
import { MenuItem, SplitButton, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import URI from 'urijs';
import { t } from '@superset-ui/translation';

import * as Actions from '../actions/sqlLab';
import SqlEditor from './SqlEditor';
import { areArraysShallowEqual } from '../../reduxUtils';
import TabStatusIcon from './TabStatusIcon';

const propTypes = {
  actions: PropTypes.object.isRequired,
  defaultDbId: PropTypes.number,
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

let queryCount = 1;

class TabbedSqlEditors extends React.PureComponent {
  constructor(props) {
    super(props);
    const sqlLabUrl = '/superset/sqllab';
    this.state = {
      sqlLabUrl,
      queriesArray: [],
      dataPreviewQueries: [],
      hideLeftBar: false,
    };
    this.removeQueryEditor = this.removeQueryEditor.bind(this);
    this.renameTab = this.renameTab.bind(this);
    this.toggleLeftBar = this.toggleLeftBar.bind(this);
    this.removeAllOtherQueryEditors = this.removeAllOtherQueryEditors.bind(this);
  }
  componentDidMount() {
    const query = URI(window.location).search(true);
    // Popping a new tab based on the querystring
    if (query.id || query.sql || query.savedQueryId || query.datasourceKey) {
      if (query.id) {
        this.props.actions.popStoredQuery(query.id);
      } else if (query.savedQueryId) {
        this.props.actions.popSavedQuery(query.savedQueryId);
      } else if (query.datasourceKey) {
        this.props.actions.popDatasourceQuery(query.datasourceKey, query.sql);
      } else if (query.sql) {
        let dbId = query.dbid;
        if (dbId) {
          dbId = parseInt(dbId, 10);
        } else {
          const databases = this.props.databases;
          const dbName = query.dbname;
          if (dbName) {
            Object.keys(databases).forEach((db) => {
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
    }
  }
  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextActiveQeId = nextProps.tabHistory[nextProps.tabHistory.length - 1];
    const queriesArray = [];
    for (const id in nextProps.queries) {
      if (nextProps.queries[id].sqlEditorId === nextActiveQeId) {
        queriesArray.push(nextProps.queries[id]);
      }
    }
    if (!areArraysShallowEqual(queriesArray, this.state.queriesArray)) {
      this.setState({ queriesArray });
    }

    const dataPreviewQueries = [];
    nextProps.tables.forEach((table) => {
      const queryId = table.dataPreviewQueryId;
      if (queryId && nextProps.queries[queryId] && table.queryEditorId === nextActiveQeId) {
        dataPreviewQueries.push(nextProps.queries[queryId]);
      }
    });
    if (!areArraysShallowEqual(dataPreviewQueries, this.state.dataPreviewQueries)) {
      this.setState({ dataPreviewQueries });
    }
  }
  popNewTab() {
    queryCount++;
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
    const qeid = this.props.tabHistory[this.props.tabHistory.length - 1];
    for (let i = 0; i < this.props.queryEditors.length; i++) {
      const qe = this.props.queryEditors[i];
      if (qe.id === qeid) {
        return qe;
      }
    }
    return null;
  }
  newQueryEditor() {
    queryCount++;
    const activeQueryEditor = this.activeQueryEditor();
    const qe = {
      title: t('Untitled Query %s', queryCount),
      dbId:
        activeQueryEditor && activeQueryEditor.dbId
          ? activeQueryEditor.dbId
          : this.props.defaultDbId,
      schema: activeQueryEditor ? activeQueryEditor.schema : null,
      autorun: false,
      sql: `${t(
        '-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.',
      )}\n\nSELECT ...`,
      queryLimit: this.props.defaultQueryLimit,
    };
    this.props.actions.addQueryEditor(qe);
  }
  handleSelect(key) {
    if (key === 'add_tab') {
      this.newQueryEditor();
    } else {
      this.props.actions.setActiveQueryEditor({ id: key });
    }
  }
  removeQueryEditor(qe) {
    this.props.actions.removeQueryEditor(qe);
  }
  removeAllOtherQueryEditors(cqe) {
    this.props.queryEditors
      .forEach(qe => qe !== cqe && this.removeQueryEditor(qe));
  }
  toggleLeftBar() {
    this.setState({ hideLeftBar: !this.state.hideLeftBar });
  }
  render() {
    const editors = this.props.queryEditors.map((qe, i) => {
      const isSelected = qe.id === this.activeQueryEditor().id;

      let latestQuery;
      if (qe.latestQueryId) {
        latestQuery = this.props.queries[qe.latestQueryId];
      }
      let database;
      if (qe.dbId) {
        database = this.props.databases[qe.dbId];
      }
      const state = latestQuery ? latestQuery.state : '';

      const title = (
        <React.Fragment>
          <TabStatusIcon onClose={() => this.removeQueryEditor(qe)} tabState={state} />{' '}
          {qe.title}{' '}
        </React.Fragment>
      );
      const tabTitle = (
        <SplitButton
          bsSize="small"
          id={'ddbtn-tab-' + i}
          className="ddbtn-tab"
          title={title}
        >
          <MenuItem eventKey="1" onClick={() => this.removeQueryEditor(qe)}>
            <div className="icon-container">
              <i className="fa fa-close" />
            </div>
            {t('Close tab')}
          </MenuItem>
          <MenuItem eventKey="2" onClick={() => this.renameTab(qe)}>
            <div className="icon-container">
              <i className="fa fa-i-cursor" />
            </div>
            {t('Rename tab')}
          </MenuItem>
          <MenuItem eventKey="3" onClick={this.toggleLeftBar}>
            <div className="icon-container">
              <i className="fa fa-cogs" />
            </div>
            {this.state.hideLeftBar ? t('Expand tool bar') : t('Hide tool bar')}
          </MenuItem>
          <MenuItem eventKey="4" onClick={() => this.removeAllOtherQueryEditors(qe)}>
            <div className="icon-container">
              <i className="fa fa-times-circle-o" />
            </div>
            {t('Close all other tabs')}
          </MenuItem>
        </SplitButton>
      );
      return (
        <Tab key={qe.id} title={tabTitle} eventKey={qe.id}>
          {isSelected && (
            <SqlEditor
              tables={this.props.tables.filter(xt => xt.queryEditorId === qe.id)}
              queryEditor={qe}
              editorQueries={this.state.queriesArray}
              dataPreviewQueries={this.state.dataPreviewQueries}
              latestQuery={latestQuery}
              database={database}
              actions={this.props.actions}
              hideLeftBar={this.state.hideLeftBar}
              defaultQueryLimit={this.props.defaultQueryLimit}
              maxRow={this.props.maxRow}
              saveQueryWarning={this.props.saveQueryWarning}
              scheduleQueryWarning={this.props.scheduleQueryWarning}
            />
          )}
        </Tab>
      );
    });
    return (
      <Tabs
        bsStyle="tabs"
        animation={false}
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        onSelect={this.handleSelect.bind(this)}
        id="a11y-query-editor-tabs"
        className="SqlEditorTabs"
      >
        {editors}
        <Tab
          title={
            <div>
              <i className="fa fa-plus-circle" />&nbsp;
            </div>
          }
          className="addEditorTab"
          eventKey="add_tab"
          disabled={this.props.offline}
        />
      </Tabs>
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

export { TabbedSqlEditors };

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(TabbedSqlEditors);
