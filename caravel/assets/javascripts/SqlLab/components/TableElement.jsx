import React from 'react';
import { ButtonGroup } from 'react-bootstrap';
import Link from './Link';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import shortid from 'shortid';

class TableElement extends React.Component {
  selectStar() {
    let cols = '';
    this.props.table.columns.forEach((col, i) => {
      cols += col.name;
      if (i < this.props.table.columns.length - 1) {
        cols += ', ';
      }
    });
    return `SELECT ${cols}\nFROM ${this.props.table.name}`;
  }
  setSelectStar () {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, this.selectStar());
  }
  popSelectStar() {
    const qe = {
      id: shortid.generate(),
      title: this.props.table.name,
      dbId: this.props.table.dbId,
      autorun: true,
      sql: this.selectStar(),
    };
    this.props.actions.addQueryEditor(qe);
  }
  render() {
    let metadata = null;
    let buttonToggle;
    if (this.props.table.expanded) {
      buttonToggle = (
        <Link
          href="#"
          onClick={this.props.actions.collapseTable.bind(this, this.props.table)}
          placement="right"
          tooltip="Collapse the table's structure information"
        >
          {this.props.table.name} <i className="fa fa-caret-up" />
        </Link>
      );
      metadata = (
        <div>
          {this.props.table.columns.map((col) => (
            <div className="clearfix">
              <span className="pull-left m-l-5">{col.name}</span>
              <span className="pull-right">{col.type}</span>
            </div>
          ))}
          <hr />
        </div>
      );
    } else {
      buttonToggle = (
        <Link
          href="#"
          onClick={this.props.actions.expandTable.bind(this, this.props.table)}
          placement="right"
          tooltip="Expand the table's structure information"
        >
          {this.props.table.name} <i className="fa fa-caret-down" />
        </Link>
      );
    }
    return (
      <div className="ws-el">
        {buttonToggle}
        <ButtonGroup className="ws-el-controls pull-right">
          <Link
            className="fa fa-pencil m-l-2"
            onClick={this.setSelectStar.bind(this)}
            tooltip="Run query in a new tab"
            href="#"
          />
          <Link
            className="fa fa-plus-circle m-l-2"
            onClick={this.popSelectStar.bind(this)}
            tooltip="Run query in a new tab"
            href="#"
          />
          <Link
            className="fa fa-trash m-l-2"
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
TableElement.propTypes = {
  table: React.PropTypes.object,
  queryEditor: React.PropTypes.object,
  actions: React.PropTypes.object,
};
TableElement.defaultProps = {
  table: null,
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(null, mapDispatchToProps)(TableElement);
