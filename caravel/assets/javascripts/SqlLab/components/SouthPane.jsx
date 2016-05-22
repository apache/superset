import { Tab, Tabs } from 'react-bootstrap';
import QueryLog from './QueryLog';
import ResultSet from './ResultSet';
import React from 'react';

class SouthPane extends React.Component {
  render() {
    let results;
    if (this.props.latestQuery) {
      if (this.props.latestQuery.state === 'running') {
        results = (
          <img className="loading" alt="Loading.." src="/static/assets/images/loading.gif" />
        );
      } else if (this.props.latestQuery.state === 'failed') {
        results = <div className="alert alert-danger">{this.props.latestQuery.msg}</div>;
      } else if (this.props.latestQuery.state === 'success') {
        results = <ResultSet showControls query={this.props.latestQuery} />;
      }
    } else {
      results = <div className="alert alert-info">Run a query to display results here</div>;
    }
    return (
      <Tabs bsStyle="pills">
        <Tab title="Results" eventKey={1}>
          <div style={{ overflow: 'auto' }}>
            {results}
          </div>
        </Tab>
        <Tab title="Query Log" eventKey={2}>
          <QueryLog />
        </Tab>
      </Tabs>
    );
  }
}

SouthPane.propTypes = {
  latestQuery: React.PropTypes.object,
};

SouthPane.defaultProps = {
};

export default SouthPane;
