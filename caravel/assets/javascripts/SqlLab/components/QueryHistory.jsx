import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import QueryTable from './QueryTable';
import { Alert } from 'react-bootstrap';

const propTypes = {
  queries: React.PropTypes.object,
  tabHistory: React.PropTypes.array,
  actions: React.PropTypes.object,
};

const defaultProps = {
  queries: {},
};

const QueryHistory = (props) => {
  const activeQeId = props.tabHistory[props.tabHistory.length - 1];
  const queriesArray = [];
  for (const id in props.queries) {
    if (props.queries[id].sqlEditorId === activeQeId) {
      queriesArray.push(props.queries[id]);
    }
  }
  if (queriesArray.length > 0) {
    return (
      <QueryTable
        columns={[
          'state', 'started', 'duration', 'progress',
          'rows', 'sql', 'output', 'actions',
        ]}
        queries={queriesArray}
        actions={props.actions}
      />
    );
  }
  return (
    <Alert bsStyle="info">
      No query history yet...
    </Alert>
  );
};
QueryHistory.propTypes = propTypes;
QueryHistory.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    queries: state.queries,
    tabHistory: state.tabHistory,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryHistory);
