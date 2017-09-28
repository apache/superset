import React from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import URI from 'urijs';

import * as Actions from '../actions';
import SqlEditor from './SqlEditor';
import CopyQueryTabUrl from './CopyQueryTabUrl';
import { areArraysShallowEqual } from '../../reduxUtils';
import { t } from '../../locales';

const propTypes = {
  actions: PropTypes.object.isRequired,
  defaultDbId: PropTypes.number,
  databases: PropTypes.object.isRequired,
  queries: PropTypes.object.isRequired,
  queryEditors: PropTypes.array,
  tabHistory: PropTypes.array.isRequired,
  tables: PropTypes.array.isRequired,
  editorHeight: PropTypes.string.isRequired,
};
const defaultProps = {
  queryEditors: [],
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
    if (query.id || query.sql || query.savedQueryId) {
      if (query.id) {
        this.props.actions.popStoredQuery(query.id);
      } else if (query.savedQueryId) {
        this.props.actions.popSavedQuery(query.savedQueryId);
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
      dbId: (activeQueryEditor && activeQueryEditor.dbId) ?
        activeQueryEditor.dbId :
        this.props.defaultDbId,
      schema: (activeQueryEditor) ? activeQueryEditor.schema : null,
      autorun: false,
      sql: 'SELECT ...',
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
      const isSelected = (qe.id === this.activeQueryEditor().id);

      let latestQuery;
      if (qe.latestQueryId) {
        latestQuery = this.props.queries[qe.latestQueryId];
      }
      let database;
      if (qe.dbId) {
        database = this.props.databases[qe.dbId];
      }
      const state = (latestQuery) ? latestQuery.state : '';

      const tabTitle = (
        <div>
          <div className={'circle ' + state} /> {qe.title} {' '}
          <DropdownButton
            bsSize="small"
            id={'ddbtn-tab-' + i}
            title=""
          >
            <MenuItem eventKey="1" onClick={this.removeQueryEditor.bind(this, qe)}>
              <i className="fa fa-close" /> {t('close tab')}
            </MenuItem>
            <MenuItem eventKey="2" onClick={this.renameTab.bind(this, qe)}>
              <i className="fa fa-i-cursor" /> {t('rename tab')}
            </MenuItem>
            {qe &&
              <CopyQueryTabUrl queryEditor={qe} />
            }
            <MenuItem eventKey="4" onClick={this.toggleLeftBar.bind(this)}>
              <i className="fa fa-cogs" />
              &nbsp;
              {this.state.hideLeftBar ? t('expand tool bar') : t('hide tool bar')}
            </MenuItem>
          </DropdownButton>
        </div>
      );
      return (
        <Tab
          key={qe.id}
          title={tabTitle}
          eventKey={qe.id}
        >
          <div className="panel panel-default">
            <div className="panel-body">
              {isSelected &&
                <SqlEditor
                  height={this.props.editorHeight}
                  tables={this.props.tables.filter(xt => (xt.queryEditorId === qe.id))}
                  queryEditor={qe}
                  editorQueries={this.state.queriesArray}
                  dataPreviewQueries={this.state.dataPreviewQueries}
                  latestQuery={latestQuery}
                  database={database}
                  actions={this.props.actions}
                  hideLeftBar={this.state.hideLeftBar}
                />
              }
            </div>
          </div>
        </Tab>);
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
            </div>}
          eventKey="add_tab"
        />
      </Tabs>
    );
  }
}
TabbedSqlEditors.propTypes = propTypes;
TabbedSqlEditors.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    databases: state.databases,
    queryEditors: state.queryEditors,
    queries: state.queries,
    tabHistory: state.tabHistory,
    tables: state.tables,
    defaultDbId: state.defaultDbId,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { TabbedSqlEditors };
export default connect(mapStateToProps, mapDispatchToProps)(TabbedSqlEditors);
