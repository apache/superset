import { Alert, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import React from 'react';

import shortid from 'shortid';

// editorQueries are queries executed by users
// passed from SqlEditor component
// queries are all queries executed
// passed from global state for the purpose of data preview tabs
const propTypes = {
  editorQueries: React.PropTypes.array.isRequired,
  queries: React.PropTypes.object.isRequired,
  actions: React.PropTypes.object.isRequired,
  dataPreviewQueryIds: React.PropTypes.array,
  activeSouthPaneTab: React.PropTypes.string,
};

const defaultProps = {
  dataPreviewQueryIds: [],
  activeSouthPaneTab: 'Results',
};

class SouthPane extends React.PureComponent {
  closeDataPreviewTab(id) {
    this.props.actions.closeDataPreview(id);
  }
  switchTab(id) {
    this.props.actions.setActiveSouthPaneTab(id);
  }
  render() {
    let latestQuery;
    const props = this.props;
    if (props.editorQueries.length > 0) {
      latestQuery = props.editorQueries[props.editorQueries.length - 1];
    }
    let results;
    if (latestQuery) {
      results = (
        <ResultSet showControls search query={latestQuery} actions={props.actions} />
      );
    } else {
      results = <Alert bsStyle="info">Run a query to display results here</Alert>;
    }

    const dataPreviewTabs = props.dataPreviewQueryIds.map((id) => {
      const query = props.queries[id];
      const tabTitle = (
        <div>
          {query.tableName}
          <i className="fa fa-close" onClick={this.closeDataPreviewTab.bind(this, id)} />
        </div>
      );
      return (
        <Tab
          title={tabTitle}
          eventKey={id}
          key={id}
        >
          <ResultSet query={query} visualize={false} csv={false} actions={props.actions} />
        </Tab>
      );
    });

    return (
      <div className="SouthPane">
        <Tabs
          bsStyle="tabs"
          id={shortid.generate()}
          activeKey={this.props.activeSouthPaneTab}
          onSelect={this.switchTab.bind(this)}
        >
          <Tab
            title="Results"
            eventKey="Results"
          >
            <div style={{ overflow: 'auto' }}>
              {results}
            </div>
          </Tab>
          <Tab
            title="Query History"
            eventKey="History"
          >
            <QueryHistory queries={props.editorQueries} actions={props.actions} />
          </Tab>
          {dataPreviewTabs}
        </Tabs>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    dataPreviewQueryIds: state.dataPreviewQueryIds,
    activeSouthPaneTab: state.activeSouthPaneTab,
    queries: state.queries,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

SouthPane.propTypes = propTypes;
SouthPane.defaultProps = defaultProps;

export default connect(mapStateToProps, mapDispatchToProps)(SouthPane);
