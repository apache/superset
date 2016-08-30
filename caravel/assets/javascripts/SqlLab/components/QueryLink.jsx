import React from 'react';
import Link from './Link';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

class QueryLink extends React.Component {
  popTab() {
    const qe = {
      id: shortid.generate(),
      title: this.props.query.title,
      dbId: this.props.query.dbId,
      autorun: false,
      sql: this.props.query.sql,
    };
    this.props.actions.addQueryEditor(qe);
  }
  render() {
    return (
      <div>
        <div className="clearfix">
          <div className="pull-left">
            <a
              href="#"
              tooltip="Pop this query in a new tab"
              onClick={this.popTab.bind(this)}
            >
              {this.props.query.title}
            </a>
          </div>
          <div className="pull-right">
            <Link
              onClick={this.props.actions.removeWorkspaceQuery.bind(this, this.props.query)}
              tooltip="Remove query from workspace"
              href="#"
            >
              &times;
            </Link>
          </div>
        </div>
        <hr />
      </div>
    );
  }
}

QueryLink.propTypes = {
  query: React.PropTypes.object,
  actions: React.PropTypes.object,
};

QueryLink.defaultProps = {
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(null, mapDispatchToProps)(QueryLink);

