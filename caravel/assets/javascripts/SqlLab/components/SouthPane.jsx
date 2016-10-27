import { Alert, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import { areArraysShallowEqual } from '../../reduxUtils';
import React from 'react';

import shortid from 'shortid';

const propTypes = {
  queries: React.PropTypes.array.isRequired,
  actions: React.PropTypes.object.isRequired,
};

class SouthPane extends React.PureComponent {
  shouldComponentUpdate(nextProps) {
    return !areArraysShallowEqual(this.props.queries, nextProps.queries);
  }
  render() {
    let latestQuery;
    const props = this.props;
    if (props.queries.length > 0) {
      latestQuery = props.queries[props.queries.length - 1];
    }
    let results;
    if (latestQuery) {
      results = (
        <ResultSet showControls search query={latestQuery} actions={props.actions} />
      );
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
            <QueryHistory queries={props.queries} actions={props.actions} />
          </Tab>
        </Tabs>
      </div>
    );
  }
}
SouthPane.propTypes = propTypes;

export default SouthPane;
