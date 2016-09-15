import React from 'react';
import { DropdownButton, MenuItem, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import SqlEditor from './SqlEditor';
import shortid from 'shortid';

let queryCount = 1;

class QueryEditors extends React.Component {
  renameTab(qe) {
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
      id: shortid.generate(),
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
  render() {
    const editors = this.props.queryEditors.map((qe, i) => {
      let latestQuery = this.props.queries[qe.latestQueryId];
      const database = this.props.databases[qe.dbId];
      const state = (latestQuery) ? latestQuery.state : '';
      const tabTitle = (
        <div>
          <div className={'circle ' + state} /> {qe.title} {' '}
          <DropdownButton
            bsSize="small"
            id={'ddbtn-tab-' + i}
          >
            <MenuItem eventKey="1" onClick={this.props.actions.removeQueryEditor.bind(this, qe)}>
              <i className="fa fa-close" /> close tab
            </MenuItem>
            <MenuItem eventKey="2" onClick={this.renameTab.bind(this, qe)}>
              <i className="fa fa-i-cursor" /> rename tab
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
              <SqlEditor
                queryEditor={qe}
                latestQuery={latestQuery}
                database={database}
              />
            </div>
          </div>
        </Tab>);
    });
    return (
      <Tabs
        bsStyle="tabs"
        activeKey={this.props.tabHistory[this.props.tabHistory.length - 1]}
        onSelect={this.handleSelect.bind(this)}
      >
        {editors}
        <Tab title={<div><i className="fa fa-plus-circle" />&nbsp;</div>} eventKey="add_tab" />
      </Tabs>
    );
  }
}
QueryEditors.propTypes = {
  actions: React.PropTypes.object,
  databases: React.PropTypes.object,
  queries: React.PropTypes.object,
  queryEditors: React.PropTypes.array,
  tabHistory: React.PropTypes.array,
};
QueryEditors.defaultProps = {
  tabHistory: [],
  queryEditors: [],
};

function mapStateToProps(state) {
  return {
    databases: state.databases,
    queryEditors: state.queryEditors,
    queries: state.queries,
    tabHistory: state.tabHistory,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryEditors);
