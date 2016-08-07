import React from 'react';
import { ButtonGroup } from 'react-bootstrap';
import Link from './Link';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

// CSS
import 'react-select/dist/react-select.css';

class TableWorkspaceElement extends React.Component {
  selectStar() {
    let cols = '';
    this.props.table.columns.forEach((col, i) => {
      cols += col.name;
      if (i < this.props.table.columns.length - 1) {
        cols += ', ';
      }
    });
    const sql = `SELECT ${cols}\nFROM ${this.props.table.name}`;
    const qe = {
      id: shortid.generate(),
      title: this.props.table.name,
      dbId: this.props.table.dbId,
      autorun: true,
      sql,
    };
    this.props.actions.addQueryEditor(qe);
  }
  render() {
    let metadata = null;
    let buttonToggle;
    if (!this.props.table.expanded) {
      buttonToggle = (
        <Link
          href="#"
          onClick={this.props.actions.expandTable.bind(this, this.props.table)}
          placement="right"
          tooltip="Collapse the table's structure information"
        >
          <i className="fa fa-minus" /> {this.props.table.name}
        </Link>
      );
      metadata = this.props.table.columns.map((col) =>
        <div className="clearfix">
          <span className="pull-left">{col.name}</span>
          <span className="pull-right">{col.type}</span>
        </div>
      );
      metadata = (
        <div style={{ 'margin-bottom': '5px' }}>{metadata}</div>
      );
    } else {
      buttonToggle = (
        <Link
          href="#"
          onClick={this.props.actions.collapseTable.bind(this, this.props.table)}
          placement="right"
          tooltip="Expand the table's structure information"
        >
          <i className="fa fa-plus" /> {this.props.table.name}
        </Link>
      );
    }
    return (
      <div className="ws-el">
        {buttonToggle}
        <ButtonGroup className="ws-el-controls pull-right">
          <Link
            className="fa fa-play"
            onClick={this.selectStar.bind(this)}
            tooltip="Run query in a new tab"
            href="#"
          />
          <Link
            className="fa fa-trash"
            onClick={this.props.actions.removeTable.bind(this, this.props.table)}
            tooltip="Remove from workspace"
            href="#"
          />
        </ButtonGroup>
        {metadata}
      </div>
    );
  }
}
TableWorkspaceElement.propTypes = {
  table: React.PropTypes.object,
  actions: React.PropTypes.object,
};
TableWorkspaceElement.defaultProps = {
  table: null,
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(null, mapDispatchToProps)(TableWorkspaceElement);

