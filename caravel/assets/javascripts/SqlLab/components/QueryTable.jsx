import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import moment from 'moment';
import { Table } from 'reactable';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

import Link from './Link';
import VisualizeModal from './VisualizeModal';

// TODO move to CSS
const STATE_COLOR_MAP = {
  failed: 'red',
  running: 'lime',
  success: 'green',
};

class QueryTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showVisualizeModal: false,
      activeQuery: null,
    };
  }
  hideVisualizeModal() {
    this.setState({ showVisualizeModal: false });
  }
  showVisualizeModal(query) {
    this.setState({ showVisualizeModal: true });
    this.setState({ activeQuery: query });
  }
  render() {
    const data = this.props.queries.map((query) => {
      const q = Object.assign({}, query);
      const since = (q.endDttm) ? q.endDttm : new Date();
      let duration = since.valueOf() - q.startDttm.valueOf();
      duration = moment.utc(duration);
      if (q.endDttm) {
        q.duration = duration.format('HH:mm:ss.SS');
      }
      q.started = moment(q.startDttm).format('HH:mm:ss');
      q.sql = <SyntaxHighlighter language="sql" style={github}>{q.sql}</SyntaxHighlighter>;
      q.state = (
        <span
          className="label label-default"
          style={{ backgroundColor: STATE_COLOR_MAP[q.state] }}
        >
          {q.state}
        </span>
      );
      q.actions = (
        <div>
          <Link
            className="fa fa-line-chart fa-lg"
            tooltip="Visualize the data out of this query"
            onClick={this.showVisualizeModal.bind(this, query)}
            href="#"
          />
          <Link
            className="fa fa-plus-circle"
            tooltip="Pop a tab containing this query"
            href="#"
          />
          <Link
            className="fa fa-trash"
            href="#"
            tooltip="Remove query from log"
            onClick={this.props.actions.removeQuery.bind(this, query)}
          />
          <Link
            className="fa fa-map-pin"
            tooltip="Pin this query to the top of this query log"
            href="#"
          />
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
          columns={['state', 'started', 'duration', 'rows', 'sql', 'actions']}
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
  queries: React.PropTypes.object,
};
QueryTable.defaultProps = {
  columns: ['state', 'started', 'duration', 'rows', 'sql', 'actions'],
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
export default connect(mapStateToProps, mapDispatchToProps)(QueryTable);
