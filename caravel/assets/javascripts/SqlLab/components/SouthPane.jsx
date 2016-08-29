import { Alert, Panel, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import React from 'react';

const SouthPane = function (props) {
  let results = <div />;
  if (props.latestQuery) {
    if (props.latestQuery.state === 'running') {
      results = (
        <img className="loading" alt="Loading.." src="/static/assets/images/loading.gif" />
      );
    } else if (props.latestQuery.state === 'failed') {
      results = <Alert bsStyle="danger">{props.latestQuery.msg}</Alert>;
    } else if (props.latestQuery.state === 'success') {
      results = <ResultSet showControls query={props.latestQuery} />;
    }
  } else {
    results = <Alert bsStyle="info">Run a query to display results here</Alert>;
  }
  return (
    <Tabs bsStyle="tabs">
      <Tab title="Results" eventKey={1}>
        <Panel>
          <div style={{ overflow: 'auto' }}>
            {results}
          </div>
        </Panel>
      </Tab>
      <Tab title="Query History" eventKey={2}>
        <Panel>
          <QueryHistory />
        </Panel>
      </Tab>
    </Tabs>
  );
};

SouthPane.propTypes = {
  latestQuery: React.PropTypes.object,
};

SouthPane.defaultProps = {
};

export default SouthPane;
