import React from 'react';

import { ButtonGroup, Well } from 'react-bootstrap';
import shortid from 'shortid';

import CopyToClipboard from '../../components/CopyToClipboard';
import Link from './Link';
import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  table: React.PropTypes.object,
  actions: React.PropTypes.object,
};

const defaultProps = {
  table: null,
  actions: {},
};

class TableElement extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sortColumns: false,
    };
  }

  popSelectStar() {
    const qe = {
      id: shortid.generate(),
      title: this.props.table.name,
      dbId: this.props.table.dbId,
      autorun: true,
      sql: this.props.table.selectStar,
    };
    this.props.actions.addQueryEditor(qe);
  }

  collapseTable(e) {
    e.preventDefault();
    this.props.actions.collapseTable(this.props.table);
  }

  expandTable(e) {
    e.preventDefault();
    this.props.actions.expandTable(this.props.table);
  }

  removeTable() {
    this.props.actions.removeTable(this.props.table);
  }
  dataPreviewModal() {
    const query = {
      dbId: this.props.table.dbId,
      sql: this.props.table.selectStar,
      tableName: this.props.table.name,
      sqlEditorId: null,
      tab: '',
      runAsync: false,
      ctas: false,
    };
    this.props.actions.runQuery(query);
  }
  toggleSortColumns() {
    this.setState({ sortColumns: !this.state.sortColumns });
  }

  render() {
    const table = this.props.table;
    let metadata = null;
    let buttonToggle;

    let header;
    if (table.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (table.partitions.partitionQuery) {
        partitionQuery = table.partitions.partitionQuery;
        const tt = 'Copy partition query to clipboard';
        partitionClipBoard = (
          <CopyToClipboard
            text={partitionQuery}
            shouldShowText={false}
            tooltipText={tt}
            copyNode={<i className="fa fa-clipboard" />}
          />
        );
      }
      let latest = [];
      for (const k in table.partitions.latest) {
        latest.push(`${k}=${table.partitions.latest[k]}`);
      }
      latest = latest.join('/');
      header = (
        <Well bsSize="small">
          <div>
            <small>
              latest partition: {latest}
            </small> {partitionClipBoard}
          </div>
        </Well>
      );
    }
    if (table.expanded) {
      buttonToggle = (
        <a
          href="#"
          onClick={(e) => { this.collapseTable(e); }}
        >
          <strong>{table.name}</strong>
          <small className="m-l-5"><i className="fa fa-minus" /></small>
        </a>
      );
      const cols = table.columns.slice();
      if (this.state.sortColumns) {
        cols.sort((a, b) => a.name.toUpperCase() > b.name.toUpperCase());
      }
      metadata = (
        <div>
          {header}
          <div className="table-columns">
            {cols.map((col) => {
              let name = col.name;
              if (col.indexed) {
                name = <strong>{col.name}</strong>;
              }
              return (
                <div className="clearfix table-column" key={shortid.generate()}>
                  <div className="pull-left m-l-10 col-name">
                    {name}
                  </div>
                  <div className="pull-right text-muted">
                    <small> {col.type}</small>
                  </div>
                </div>);
            })}
            <hr />
          </div>
        </div>
      );
    } else {
      buttonToggle = (
        <a
          href="#"
          onClick={(e) => { this.expandTable(e); }}
        >
          {table.name}
          <small className="m-l-5"><i className="fa fa-plus" /></small>
        </a>
      );
    }
    let keyLink;
    if (table.indexes && table.indexes.length > 0) {
      keyLink = (
        <ModalTrigger
          modalTitle={
            <div>
              Keys for table <strong>{table.name}</strong>
            </div>
          }
          modalBody={
            <pre>{JSON.stringify(table.indexes, null, 4)}</pre>
          }
          triggerNode={
            <Link
              className="fa fa-key pull-left m-l-2"
              tooltip={`View indexes (${table.indexes.length})`}
            />
          }
        />
      );
    }
    return (
      <div className="TableElement">
        <div className="clearfix">
          <div className="pull-left">
            {buttonToggle}
          </div>
          <div className="pull-right">
            <ButtonGroup className="ws-el-controls pull-right">
              {keyLink}
              <Link
                className={
                  `fa fa-sort-${!this.state.sortColumns ? 'alpha' : 'numeric'}-asc ` +
                  'pull-left sort-cols m-l-2'}
                onClick={this.toggleSortColumns.bind(this)}
                tooltip={
                  !this.state.sortColumns ?
                  'Sort columns alphabetically' :
                  'Original table column order'}
                href="#"
              />
              <Link
                className="fa fa-search-plus pull-left m-l-2"
                onClick={this.dataPreviewModal.bind(this)}
                tooltip="Data preview"
                href="#"
              />
              <CopyToClipboard
                copyNode={
                  <a className="fa fa-clipboard pull-left m-l-2" />
                }
                text={table.selectStar}
                shouldShowText={false}
                tooltipText="Copy SELECT statement to clipboard"
              />
              <Link
                className="fa fa-trash pull-left m-l-2"
                onClick={this.removeTable.bind(this)}
                tooltip="Remove from panel"
                href="#"
              />
            </ButtonGroup>
          </div>
        </div>
        <div>
          {metadata}
        </div>
      </div>
    );
  }
}
TableElement.propTypes = propTypes;
TableElement.defaultProps = defaultProps;

export default TableElement;
