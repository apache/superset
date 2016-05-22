import React from 'react';
import { ButtonGroup } from 'react-bootstrap';
import Link from './Link';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

// CSS
import 'react-select/dist/react-select.css';

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
      <div className="ws-el">
        {this.props.query.title}
        <ButtonGroup className="ws-el-controls pull-right">
          <Link
            className="fa fa-plus-circle"
            onClick={this.popTab.bind(this)}
            tooltip="Pop this query in a new tab"
            href="#"
          />
          <Link
            className="fa fa-trash"
            onClick={this.props.actions.removeWorkspaceQuery.bind(this, this.props.query)}
            tooltip="Remove query from workspace"
            href="#"
          />
        </ButtonGroup>
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

