import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import moment from 'moment';
import { Table } from 'reactable';
import { ProgressBar } from 'react-bootstrap';
import Link from './Link';
import VisualizeModal from './VisualizeModal';
import SqlShrink from './SqlShrink';
import { STATE_BSSTYLE_MAP } from '../common';
import { fDuration } from '../../modules/dates';
import { getLink } from '../../../utils/common';


class QueryTable extends React.Component {
  constructor(props) {
    super(props);
    const uri = window.location.toString();
    const cleanUri = uri.substring(0, uri.indexOf('#'));
    this.state = {
      cleanUri,
      showVisualizeModal: false,
      activeQuery: null,
    };
  }
  getQueryLink(dbId, sql) {
    const params = ['dbid=' + dbId, 'sql=' + sql, 'title=Untitled Query'];
    const link = getLink(this.state.cleanUri, params);
    return encodeURI(link);
  }
  hideVisualizeModal() {
    this.setState({ showVisualizeModal: false });
  }
  showVisualizeModal(query) {
    this.setState({ showVisualizeModal: true });
    this.setState({ activeQuery: query });
  }
  restoreSql(query) {
    this.props.actions.queryEditorSetSql({ id: query.sqlEditorId }, query.sql);
  }
  notImplemented() {
    /* eslint no-alert: 0 */
    alert('Not implemented yet!');
  }
  render() {
    const data = this.props.queries.map((query) => {
      const q = Object.assign({}, query);
      if (q.endDttm) {
        q.duration = fDuration(q.startDttm, q.endDttm);
      }
      q.user = (
        <button
          className="btn btn-link btn-xs"
          onClick={this.props.onUserClicked.bind(this, q.userId)}
        >
          {q.user}
        </button>
      );
      q.db = (
        <button
          className="btn btn-link btn-xs"
          onClick={this.props.onDbClicked.bind(this, q.dbId)}
        >
          {q.db}
        </button>
      );
      q.started = moment(q.startDttm).format('HH:mm:ss');
      const source = (q.ctas) ? q.executedSql : q.sql;
      q.sql = (
        <SqlShrink sql={source} maxWidth={100} />
      );
      q.output = q.tempTable;
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
      q.actions = (
        <div style={{ width: '75px' }}>
          <Link
            className="fa fa-line-chart m-r-3"
            tooltip="Visualize the data out of this query"
            onClick={this.showVisualizeModal.bind(this, query)}
          />
          <Link
            className="fa fa-pencil m-r-3"
            onClick={this.restoreSql.bind(this, query)}
            tooltip="Overwrite text in editor with a query on this table"
            placement="top"
          />
          <Link
            className="fa fa-plus-circle m-r-3"
            onClick={self.notImplemented}
            tooltip="Run query in a new tab"
            placement="top"
          />
          <Link
            className="fa fa-trash m-r-3"
            tooltip="Remove query from log"
            onClick={this.props.actions.removeQuery.bind(this, query)}
          />
        </div>
      );
      q.querylink = (
        <div style={{ width: '100px' }}>
          <a
            href={this.getQueryLink(q.dbId, source)}
            className="btn btn-primary btn-xs"
          >
            <i className="fa fa-external-link" />Open in SQL Editor
          </a>
        </div>
      );
      return q;
    }).reverse();
    return (
      <div>
        <VisualizeModal
          show={this.state.showVisualizeModal}
          query={this.state.activeQuery}
          onHide={this.hideVisualizeModal.bind(this)}
        />
        <Table
          columns={this.props.columns}
          className="table table-condensed"
          data={data}
        />
      </div>
    );
  }
}
QueryTable.propTypes = {
  columns: React.PropTypes.array,
  actions: React.PropTypes.object,
  queries: React.PropTypes.array,
  onUserClicked: React.PropTypes.func,
  onDbClicked: React.PropTypes.func,
};
QueryTable.defaultProps = {
  columns: ['started', 'duration', 'rows'],
  queries: [],
  onUserClicked: () => {},
  onDbClicked: () => {},
};

function mapStateToProps() {
  return {};
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(QueryTable);
