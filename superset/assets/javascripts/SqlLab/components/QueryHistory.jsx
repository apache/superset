import React from 'react';

import QueryTable from './QueryTable';
import { Alert } from 'react-bootstrap';

const propTypes = {
  queries: React.PropTypes.array.isRequired,
  actions: React.PropTypes.object.isRequired,
};

const QueryHistory = (props) => {
  if (props.queries.length > 0) {
    return (
      <QueryTable
        columns={[
          'state', 'started', 'duration', 'progress',
          'rows', 'sql', 'output', 'actions',
        ]}
        queries={props.queries}
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

export default QueryHistory;
