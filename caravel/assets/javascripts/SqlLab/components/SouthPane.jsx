import { Alert, Button, Tab, Tabs } from 'react-bootstrap';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

class SouthPane extends React.Component {
  popSelectStar() {
    const qe = {
      id: shortid.generate(),
      title: this.props.latestQuery.tempTable,
      autorun: false,
      dbId: this.props.latestQuery.dbId,
      sql: `SELECT * FROM ${this.props.latestQuery.tempTable}`,
    };
    this.props.actions.addQueryEditor(qe);
  }
  render() {
    let results = <div />;
    const latestQuery = this.props.latestQuery;
    if (latestQuery) {
      if (['running', 'pending'].includes(latestQuery.state)) {
        results = (
          <img className="loading" alt="Loading.." src="/static/assets/images/loading.gif" />
        );
      } else if (latestQuery.state === 'failed') {
        results = <Alert bsStyle="danger">{latestQuery.errorMessage}</Alert>;
      } else if (latestQuery.state === 'success' && latestQuery.ctas) {
        results = (
          <div>
            <Alert bsStyle="info">
              Table [<strong>{latestQuery.tempTable}</strong>] was created
            </Alert>
            <p>
              <Button
                bsSize="small"
                className="m-r-5"
                onClick={this.popSelectStar.bind(this)}
              >
                Query in a new tab
              </Button>
              <Button bsSize="small">Visualize</Button>
            </p>
          </div>);
      } else if (latestQuery.state === 'success') {
        results = <ResultSet showControls search query={latestQuery} />;
      }
    } else {
      results = <Alert bsStyle="info">Run a query to display results here</Alert>;
    }
    return (
      <div className="SouthPane">
        <Tabs bsStyle="tabs" id={shortid.generate()}>
          <Tab title="Results" eventKey={1} id={shortid.generate()}>
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
  }
}

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
