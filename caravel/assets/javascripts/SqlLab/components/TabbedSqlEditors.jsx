import React from 'react';
import { DropdownButton, MenuItem, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import SqlEditor from './SqlEditor';
import { getParamFromQuery } from '../../../utils/common';
import CopyQueryTabUrl from './CopyQueryTabUrl';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  databases: React.PropTypes.object.isRequired,
  queries: React.PropTypes.object.isRequired,
  queryEditors: React.PropTypes.array,
  tabHistory: React.PropTypes.array.isRequired,
  tables: React.PropTypes.array.isRequired,
  networkOn: React.PropTypes.bool,
};
const defaultProps = {
  queryEditors: [],
  networkOn: true,
};

let queryCount = 1;

class TabbedSqlEditors extends React.PureComponent {
  constructor(props) {
    super(props);
    const uri = window.location.toString();
    const search = window.location.search;
    const cleanUri = search ? uri.substring(0, uri.indexOf('?')) : uri;
    const query = search.substring(1);
    this.state = {
      uri,
      cleanUri,
      query,
    };
  }
  componentWillMount() {
    if (this.state.query) {
      queryCount++;
      const queryEditorProps = {
        title: getParamFromQuery(this.state.query, 'title'),
        dbId: parseInt(getParamFromQuery(this.state.query, 'dbid'), 10),
        schema: getParamFromQuery(this.state.query, 'schema'),
        autorun: getParamFromQuery(this.state.query, 'autorun'),
        sql: getParamFromQuery(this.state.query, 'sql'),
      };
      this.props.actions.addQueryEditor(queryEditorProps);
      // Clean the url in browser history
      window.history.replaceState({}, document.title, this.state.cleanUri);
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
      dbId: (activeQueryEditor) ? activeQueryEditor.dbId : null,
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
  render() {
    const editors = this.props.queryEditors.map((qe, i) => {
      const isSelected = (qe.id === this.activeQueryEditor().id);
      const queriesArray = [];
      for (const id in this.props.queries) {
        if (this.props.queries[id].sqlEditorId === qe.id) {
          queriesArray.push(this.props.queries[id]);
        }
      }
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
              <MenuItem eventKey="3">
                <i className="fa fa-clipboard" /> <CopyQueryTabUrl queryEditor={qe} />
              </MenuItem>
            }
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
                  tables={this.props.tables.filter((t) => (t.queryEditorId === qe.id))}
                  queryEditor={qe}
                  queries={queriesArray}
                  latestQuery={latestQuery}
                  database={database}
                  actions={this.props.actions}
                  networkOn={this.props.networkOn}
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
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { TabbedSqlEditors };
export default connect(mapStateToProps, mapDispatchToProps)(TabbedSqlEditors);
