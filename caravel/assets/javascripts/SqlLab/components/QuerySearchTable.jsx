import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import { Table } from 'reactable';
import { ProgressBar } from 'react-bootstrap';
import Link from './Link';
import SqlShrink from './SqlShrink';
import { STATE_BSSTYLE_MAP } from '../common';


class QuerySearchTable extends React.Component {
  render() {
    const data = this.props.queries.map((query) => {
      const q = Object.assign({}, query);
      const source = q.ctas ? q.executedSql : q.sql;
      q.sql = (
        <SqlShrink sql={source} />
      );
      q.progress = (
        <ProgressBar
          style={{ width: '75px' }}
          striped
          now={q.progress}
          label={`${q.progress}%`}
        />
      );
      let errorTooltip;
      if (q.errorMessage) {
        errorTooltip = (
          <Link tooltip={q.errorMessage}>
            <i className="fa fa-exclamation-circle text-danger" />
          </Link>
        );
      }
      q.state = (
        <div>
          <span className={'m-r-3 label label-' + STATE_BSSTYLE_MAP[q.state]}>
            {q.state}
          </span>
          {errorTooltip}
        </div>
      );
      return q;
    }).reverse();
    return (
      <div>
        <Table
          columns={this.props.columns}
          className="table table-condensed"
          data={data}
        />
      </div>
    );
  }
}
QuerySearchTable.propTypes = {
  columns: React.PropTypes.array,
  actions: React.PropTypes.object,
  queries: React.PropTypes.array,
};
QuerySearchTable.defaultProps = {
  columns: ['state', 'dbId', 'userId', 'progress', 'rows', 'sql'],
  queries: [],
};

function mapStateToProps() {
  return {};
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(QuerySearchTable);
