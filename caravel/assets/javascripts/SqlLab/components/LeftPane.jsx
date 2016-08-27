import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import QueryLink from './QueryLink';

import 'react-select/dist/react-select.css';

const LeftPane = (props) => {
  let queryElements;
  if (props.workspaceQueries.length > 0) {
    queryElements = props.workspaceQueries.map((q) => <QueryLink query={q} />);
  } else {
    queryElements = (
      <Alert bsStyle="info">
        Use the save button on the SQL editor to save a query
        into this section for future reference.
      </Alert>
    );
  }
  return (
    <div>
      <div className="panel panel-default LeftPane">
        <div className="panel-heading">
          <div className="panel-title">
            Saved Queries
          </div>
        </div>
        <div className="panel-body">
          {queryElements}
        </div>
      </div>
      <br /><br />
      <Button onClick={props.actions.resetState.bind(this)} bsStyle="danger">
        Reset State
      </Button>
    </div>
  );
};

LeftPane.propTypes = {
  workspaceQueries: React.PropTypes.array,
  actions: React.PropTypes.object,
};

LeftPane.defaultProps = {
  workspaceQueries: [],
};

function mapStateToProps(state) {
  return {
    workspaceQueries: state.workspaceQueries,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(LeftPane);
