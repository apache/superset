import { Panel, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import React from 'react';

const SouthPane = (props) => {
  let results;
  if (props.latestQuery) {
    if (props.latestQuery.state === 'running') {
      results = (
        <img className="loading" alt="Loading.." src="/static/assets/images/loading.gif" />
      );
    } else if (props.latestQuery.state === 'failed') {
      results = <div className="alert alert-danger">{props.latestQuery.msg}</div>;
    } else if (props.latestQuery.state === 'success') {
      results = <ResultSet showControls query={props.latestQuery} />;
    }
  } else {
    results = <div className="alert alert-info">Run a query to display results here</div>;
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
