/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, Collapse, Fade, Well } from 'react-bootstrap';
import shortid from 'shortid';
import { t } from '@superset-ui/translation';

import CopyToClipboard from '../../components/CopyToClipboard';
import Link from '../../components/Link';
import ColumnElement from './ColumnElement';
import ShowSQL from './ShowSQL';
import ModalTrigger from '../../components/ModalTrigger';
import Loading from '../../components/Loading';

const propTypes = {
  table: PropTypes.object,
  actions: PropTypes.object,
  timeout: PropTypes.number, // used for tests
};

const defaultProps = {
  actions: {},
  table: null,
  timeout: 500,
};

class TableElement extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sortColumns: false,
      expanded: true,
      hovered: false,
    };
    this.removeFromStore = this.removeFromStore.bind(this);
    this.toggleSortColumns = this.toggleSortColumns.bind(this);
    this.removeTable = this.removeTable.bind(this);
    this.setHover = this.setHover.bind(this);
  }

  setHover(hovered) {
    this.setState({ hovered });
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

  toggleTable(e) {
    e.preventDefault();
    if (this.props.table.expanded) {
      this.props.actions.collapseTable(this.props.table);
    } else {
      this.props.actions.expandTable(this.props.table);
    }
  }

  removeTable() {
    this.setState({ expanded: false });
    this.props.actions.removeDataPreview(this.props.table);
  }
  toggleSortColumns() {
    this.setState({ sortColumns: !this.state.sortColumns });
  }

  removeFromStore() {
    this.props.actions.removeTable(this.props.table);
  }

  renderWell() {
    const table = this.props.table;
    let header;
    if (table.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (table.partitions.partitionQuery) {
        partitionQuery = table.partitions.partitionQuery;
        const tt = t('Copy partition query to clipboard');
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
              {t('latest partition:')} {latest}
            </small>{' '}
            {partitionClipBoard}
          </div>
        </Well>
      );
    }
    return header;
  }
  renderControls() {
    let keyLink;
    const table = this.props.table;
    if (table.indexes && table.indexes.length > 0) {
      keyLink = (
        <ModalTrigger
          modalTitle={
            <div>
              {t('Keys for table')} <strong>{table.name}</strong>
            </div>
          }
          modalBody={table.indexes.map((ix, i) => (
            <pre key={i}>{JSON.stringify(ix, null, '  ')}</pre>
          ))}
          triggerNode={
            <Link
              className="fa fa-key pull-left m-l-2"
              tooltip={t('View keys & indexes (%s)', table.indexes.length)}
            />
          }
        />
      );
    }
    return (
      <ButtonGroup className="ws-el-controls">
        {keyLink}
        <Link
          className={
            `fa fa-sort-${!this.state.sortColumns ? 'alpha' : 'numeric'}-asc ` +
            'pull-left sort-cols m-l-2'
          }
          onClick={this.toggleSortColumns}
          tooltip={
            !this.state.sortColumns
              ? t('Sort columns alphabetically')
              : t('Original table column order')
          }
          href="#"
        />
        {table.selectStar && (
          <CopyToClipboard
            copyNode={<a className="fa fa-clipboard pull-left m-l-2" />}
            text={table.selectStar}
            shouldShowText={false}
            tooltipText={t('Copy SELECT statement to the clipboard')}
          />
        )}
        {table.view && (
          <ShowSQL
            sql={table.view}
            tooltipText={t('Show CREATE VIEW statement')}
            title={t('CREATE VIEW statement')}
          />
        )}
        <Link
          className="fa fa-times table-remove pull-left m-l-2"
          onClick={this.removeTable}
          tooltip={t('Remove table preview')}
          href="#"
        />
      </ButtonGroup>
    );
  }
  renderHeader() {
    const table = this.props.table;
    return (
      <div className="clearfix">
        <div className="pull-left">
          <a
            href="#"
            className="table-name"
            onClick={e => {
              this.toggleTable(e);
            }}
          >
            <strong>{table.name}</strong>
          </a>
        </div>
        <div className="pull-right">
          {table.isMetadataLoading || table.isExtraMetadataLoading ? (
            <Loading position="inline" />
          ) : (
            <Fade in={this.state.hovered}>{this.renderControls()}</Fade>
          )}
          <i
            role="button"
            tabIndex={0}
            onClick={e => {
              this.toggleTable(e);
            }}
            className={
              'text-primary pointer m-l-10 ' +
              'fa fa-lg ' +
              `fa-angle-${table.expanded ? 'up' : 'down'}`
            }
          />
        </div>
      </div>
    );
  }
  renderBody() {
    const table = this.props.table;
    let cols;
    if (table.columns) {
      cols = table.columns.slice();
      if (this.state.sortColumns) {
        cols.sort((a, b) => {
          const colA = a.name.toUpperCase();
          const colB = b.name.toUpperCase();
          if (colA < colB) {
            return -1;
          } else if (colA > colB) {
            return 1;
          }
          return 0;
        });
      }
    }
    const metadata = (
      <Collapse in={table.expanded} timeout={this.props.timeout}>
        <div>
          {this.renderWell()}
          <div className="table-columns m-t-5">
            {cols &&
              cols.map(col => <ColumnElement column={col} key={col.name} />)}
          </div>
        </div>
      </Collapse>
    );
    return metadata;
  }

  render() {
    return (
      <Collapse
        in={this.state.expanded}
        timeout={this.props.timeout}
        onExited={this.removeFromStore}
      >
        <div
          className="TableElement table-schema m-b-10"
          onMouseEnter={() => this.setHover(true)}
          onMouseLeave={() => this.setHover(false)}
        >
          {this.renderHeader()}
          <div>{this.renderBody()}</div>
        </div>
      </Collapse>
    );
  }
}
TableElement.propTypes = propTypes;
TableElement.defaultProps = defaultProps;

export default TableElement;
