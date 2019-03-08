import React from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem, Tab, Tabs } from 'react-bootstrap';
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
  getHeight: PropTypes.func.isRequired,
  offline: PropTypes.bool,
};
const defaultProps = {
  queryEditors: [],
  offline: false,
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
  componentWillReceiveProps(nextProps) {
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

      const tabTitle = (
        <div>
          <TabStatusIcon onClose={this.removeQueryEditor.bind(this, qe)} tabState={state} />{' '}
          {qe.title}{' '}
          <DropdownButton
            bsSize="small"
            id={'ddbtn-tab-' + i}
            className="ddbtn-tab"
            title=""
          >
            <MenuItem eventKey="1" onClick={this.removeQueryEditor.bind(this, qe)}>
              <div className="icon-container">
                <i className="fa fa-close" />
              </div>
              {t('Close tab')}
            </MenuItem>
            <MenuItem eventKey="2" onClick={this.renameTab.bind(this, qe)}>
              <div className="icon-container">
                <i className="fa fa-i-cursor" />
              </div>
              {t('Rename tab')}
            </MenuItem>
            <MenuItem eventKey="3" onClick={this.toggleLeftBar.bind(this)}>
              <div className="icon-container">
                <i className="fa fa-cogs" />
              </div>
              {this.state.hideLeftBar ? t('Expand tool bar') : t('Hide tool bar')}
            </MenuItem>
          </DropdownButton>
        </div>
      );
      return (
        <Tab key={qe.id} title={tabTitle} eventKey={qe.id}>
          <div className="panel panel-default">
            <div className="panel-body">
              {isSelected && (
                <SqlEditor
                  getHeight={this.props.getHeight}
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
                />
              )}
            </div>
          </div>
        </Tab>
      );
    });
    return (
      <Tabs
        bsStyle="tabs"
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        onSelect={this.handleSelect.bind(this)}
        id="a11y-query-editor-tabs"
      >
        {editors}
        <Tab
          title={
            <div>
              <i className="fa fa-plus-circle" />&nbsp;
            </div>
          }
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
