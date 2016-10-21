import { Alert, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

const SouthPane = function (props) {
  let results = <div />;
  const latestQuery = props.latestQuery;
  if (latestQuery) {
    results = <ResultSet showControls search query={latestQuery} />;
  } else {
    results = <Alert bsStyle="info">Run a query to display results here</Alert>;
  }
  return (
    <div className="SouthPane">
      <Tabs bsStyle="tabs" id={shortid.generate()}>
        <Tab title="Results" eventKey={1}>
          <div style={{ overflow: 'auto' }}>
            {results}
          </div>
        </Tab>
        <Tab title="Query History" eventKey={2}>
          <QueryHistory />
        </Tab>
      </Tabs>
    </div>
  );
};

SouthPane.propTypes = {
  latestQuery: React.PropTypes.object,
  actions: React.PropTypes.object,
};

SouthPane.defaultProps = {
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(null, mapDispatchToProps)(SouthPane);
