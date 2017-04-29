import React from 'react';
import PropTypes from 'prop-types';
import shortid from 'shortid';
import { Alert, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as Actions from '../actions';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';

/*
    editorQueries are queries executed by users passed from SqlEditor component
    dataPrebiewQueries are all queries executed for preview of table data (from SqlEditorLeft)
*/
const propTypes = {
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
  activeSouthPaneTab: PropTypes.string,
};

const defaultProps = {
  activeSouthPaneTab: 'Results',
};

class SouthPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      innerTabHeight: this.getInnerTabHeight(),
    };
  }
  getInnerTabHeight() {
    // hack to get height the tab container so it can be fixed and scroll in place
    // calculate inner tab height

    // document.getElementById('brace-editor').getBoundingClientRect().height;
    const sqlEditorHeight = 192;

    // document.getElementById('js-sql-toolbar').getBoundingClientRect().height;
    const sqlToolbar = 30;

    // document.getElementsByClassName('nav-tabs')[0].getBoundingClientRect().height * 2;
    const tabsHeight = 88;

    // document.getElementsByTagName('header')[0].getBoundingClientRect().height;
    const headerHeight = 59;

    const sum =
      sqlEditorHeight +
      sqlToolbar +
      tabsHeight +
      headerHeight;

    return window.innerHeight - sum - 95;
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
        <ResultSet
          showControls
          search
          query={latestQuery}
          actions={props.actions}
          height={this.state.innerTabHeight}
        />
      );
    } else {
      results = <Alert bsStyle="info">Run a query to display results here</Alert>;
    }

    const dataPreviewTabs = props.dataPreviewQueries.map(query => (
      <Tab
        title={`Preview for ${query.tableName}`}
        eventKey={query.id}
        key={query.id}
      >
        <ResultSet
          query={query}
          visualize={false}
          csv={false}
          actions={props.actions}
          cache
          height={this.state.innerTabHeight}
        />
      </Tab>
    ));

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
            {results}
          </Tab>
          <Tab
            title="Query History"
            eventKey="History"
          >
            <div style={{ height: `${this.state.innerTabHeight}px`, overflow: 'scroll' }}>
              <QueryHistory queries={props.editorQueries} actions={props.actions} />
            </div>
          </Tab>
          {dataPreviewTabs}
        </Tabs>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    activeSouthPaneTab: state.activeSouthPaneTab,
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
