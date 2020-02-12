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
import shortid from 'shortid';
import { t } from '@superset-ui/translation';
import Button from '../components/Button';
import Fieldset from './Fieldset';
import { recurseReactClone } from './utils';
import './styles.css';

const propTypes = {
  collection: PropTypes.arrayOf(PropTypes.object).isRequired,
  itemGenerator: PropTypes.func,
  columnLabels: PropTypes.object,
  tableColumns: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  itemRenderers: PropTypes.object,
  allowDeletes: PropTypes.bool,
  expandFieldset: PropTypes.node,
  emptyMessage: PropTypes.node,
  extraButtons: PropTypes.node,
  allowAddItem: PropTypes.bool,
};
const defaultProps = {
  onChange: () => {},
  itemRenderers: {},
  columnLabels: {},
  allowDeletes: false,
  emptyMessage: 'No entries',
  allowAddItem: false,
  itemGenerator: () => ({}),
  expandFieldset: null,
  extraButtons: null,
};
const Frame = props => (
  <div className="frame">
    {props.children}
  </div>);
Frame.propTypes = { children: PropTypes.node };

function createKeyedCollection(arr) {
  const newArr = arr.map(o => ({
    ...o,
    id: o.id || shortid.generate(),
  }));
  const map = {};
  newArr.forEach((o) => {
    map[o.id] = o;
  });
  return map;
}

export default class CRUDCollection extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      expandedColumns: {},
      collection: createKeyedCollection(props.collection),
    };
    this.renderItem = this.renderItem.bind(this);
    this.onAddItem = this.onAddItem.bind(this);
    this.renderExpandableSection = this.renderExpandableSection.bind(this);
    this.getLabel = this.getLabel.bind(this);
    this.onFieldsetChange = this.onFieldsetChange.bind(this);
    this.renderTableBody = this.renderTableBody.bind(this);
    this.changeCollection = this.changeCollection.bind(this);
  }
  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.collection !== this.props.collection) {
      this.setState({
        collection: createKeyedCollection(nextProps.collection),
      });
    }
  }
  onCellChange(id, col, val) {
    this.changeCollection({
      ...this.state.collection,
      [id]: {
        ...this.state.collection[id],
        [col]: val,
      },
    });

  }
  onAddItem() {
    let newItem = this.props.itemGenerator();
    if (!newItem.id) {
      newItem = { ...newItem, id: shortid.generate() };
    }
    this.changeCollection({
      ...this.state.collection,
      [newItem.id]: newItem,
    });
  }
  onFieldsetChange(item) {
    this.changeCollection({
      ...this.state.collection,
      [item.id]: item,
    });
  }
  getLabel(col) {
    const { columnLabels } = this.props;
    let label = columnLabels[col] ? columnLabels[col] : col;
    if (label.startsWith('__')) {
      // special label-free columns (ie: caret for expand, delete cross)
      label = '';
    }
    return label;
  }
  changeCollection(collection) {
    this.setState({ collection });
    this.props.onChange(Object.keys(collection).map(k => collection[k]));
  }
  deleteItem(id) {
    const newColl = { ...this.state.collection };
    delete newColl[id];
    this.changeCollection(newColl);
  }
  effectiveTableColumns() {
    const { tableColumns, allowDeletes, expandFieldset } = this.props;
    const cols = allowDeletes ? tableColumns.concat(['__actions']) : tableColumns;
    return expandFieldset ? ['__expand'].concat(cols) : cols;
  }
  toggleExpand(id) {
    this.onCellChange(id, '__expanded', false);
    this.setState({
      expandedColumns: {
        ...this.state.expandedColumns,
        [id]: !this.state.expandedColumns[id],
      },
    });
  }
  renderHeaderRow() {
    const cols = this.effectiveTableColumns();
    return (
      <thead>
        <tr>
          {this.props.expandFieldset && <th className="tiny-cell" />}
          {cols.map(col => <th key={col}>{this.getLabel(col)}</th>)}
          {this.props.allowDeletes && <th className="tiny-cell" />}
        </tr>
      </thead>
    );
  }
  renderExpandableSection(item) {
    const propsGenerator = () => ({ item, onChange: this.onFieldsetChange });
    return recurseReactClone(this.props.expandFieldset, Fieldset, propsGenerator);
  }
  renderCell(record, col) {
    const renderer = this.props.itemRenderers[col];
    const val = record[col];
    const onChange = this.onCellChange.bind(this, record.id, col);
    return renderer ? renderer(val, onChange, this.getLabel(col)) : val;
  }
  renderItem(record) {
    const { tableColumns, allowDeletes, expandFieldset } = this.props;
    /* eslint-disable no-underscore-dangle */
    const isExpanded = !!this.state.expandedColumns[record.id] || record.__expanded;
    let tds = [];
    if (expandFieldset) {
      tds.push(
        <td key="__expand" className="expand">
          <i
            className={`fa fa-caret-${isExpanded ? 'down' : 'right'} text-primary pointer`}
            onClick={this.toggleExpand.bind(this, record.id)}
          />
        </td>);
    }
    tds = tds.concat(tableColumns.map(col => (
      <td key={col}>{this.renderCell(record, col)}</td>
    )));
    if (allowDeletes) {
      tds.push(
        <td key="__actions">
          <i
            className="fa fa-close text-primary pointer"
            onClick={this.deleteItem.bind(this, record.id)}
          />
        </td>);
    }
    const trs = [<tr className="row" key={record.id}>{tds}</tr>];
    if (isExpanded) {
      trs.push(
        <tr className="exp" key={'exp__' + record.id}>
          <td colSpan={this.effectiveTableColumns().length} className="expanded">
            <div>
              {this.renderExpandableSection(record)}
            </div>
          </td>
        </tr>);
    }
    return trs;
  }
  renderEmptyCell() {
    return <tr><td className="empty-collection">{this.props.emptyMessage}</td></tr>;
  }
  renderTableBody() {
    const data = Object.keys(this.state.collection).map(k => this.state.collection[k]);
    const content = data.length ? data.map(d => this.renderItem(d)) : this.renderEmptyCell();
    return <tbody>{content}</tbody>;
  }
  render() {
    return (
      <div className="CRUD">
        <table
          className="table"
        >
          {this.renderHeaderRow()}
          {this.renderTableBody()}
        </table>
        <div>
          {this.props.allowAddItem &&
            <Button bsStyle="primary" onClick={this.onAddItem}>
              <i className="fa fa-plus" /> {t('Add Item')}
            </Button>}
          {this.props.extraButtons}
        </div>
      </div>
    );
  }
}
CRUDCollection.defaultProps = defaultProps;
CRUDCollection.propTypes = propTypes;
