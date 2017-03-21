import React from 'react';
import { DropdownButton, MenuItem, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import SqlEditor from './SqlEditor';
import CopyQueryTabUrl from './CopyQueryTabUrl';
import { areArraysShallowEqual } from '../../reduxUtils';
import { getParamFromQuery } from '../../../utils/common';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  databases: React.PropTypes.object.isRequired,
  queries: React.PropTypes.object.isRequired,
  queryEditors: React.PropTypes.array,
  tabHistory: React.PropTypes.array.isRequired,
  tables: React.PropTypes.array.isRequired,
  networkOn: React.PropTypes.bool,
  editorHeight: React.PropTypes.string.isRequired,
};
const defaultProps = {
  queryEditors: [],
  networkOn: true,
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
    const search = window.location.search;
    if (search) {
      const queryString = search.substring(1);
      const urlId = getParamFromQuery(queryString, 'id');
      if (urlId) {
        this.props.actions.popStoredQuery(urlId);
      } else {
        let dbId = getParamFromQuery(queryString, 'dbid');
        if (dbId) {
          dbId = parseInt(dbId, 10);
        } else {
          const databases = this.props.databases;
          const dbName = getParamFromQuery(queryString, 'dbname');
          if (dbName) {
            Object.keys(databases).forEach((db) => {
              if (databases[db].database_name === dbName) {
                dbId = databases[db].id;
              }
            });
          }
        }
        const newQueryEditor = {
          title: getParamFromQuery(queryString, 'title'),
          dbId,
          schema: getParamFromQuery(queryString, 'schema'),
          autorun: getParamFromQuery(queryString, 'autorun'),
          sql: getParamFromQuery(queryString, 'sql'),
        };
        this.props.actions.addQueryEditor(newQueryEditor);
      }
      this.popNewTab();
    }
  }
  popNewTab() {
    queryCount++;
    // Clean the url in browser history
    window.history.replaceState({}, document.title, this.state.sqlLabUrl);
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
  renameTab(qe) {
    /* eslint no-alert: 0 */
    const newTitle = prompt('Enter a new title for the tab');
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
      title: `Untitled Query ${queryCount}`,
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
              <i className="fa fa-close" /> close tab
            </MenuItem>
            <MenuItem eventKey="2" onClick={this.renameTab.bind(this, qe)}>
              <i className="fa fa-i-cursor" /> rename tab
            </MenuItem>
            {qe &&
              <CopyQueryTabUrl queryEditor={qe} />
            }
            <MenuItem eventKey="4" onClick={this.toggleLeftBar.bind(this)}>
              <i className="fa fa-cogs" />
              &nbsp;
              {this.state.hideLeftBar ? 'expand tool bar' : 'hide tool bar'}
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
                  tables={this.props.tables.filter((t) => (t.queryEditorId === qe.id))}
                  queryEditor={qe}
                  editorQueries={this.state.queriesArray}
                  dataPreviewQueries={this.state.dataPreviewQueries}
                  latestQuery={latestQuery}
                  database={database}
                  actions={this.props.actions}
                  networkOn={this.props.networkOn}
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
    networkOn: state.networkOn,
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
