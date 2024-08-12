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
import {
  ReactNode,
  DetailedHTMLProps,
  TdHTMLAttributes,
  PureComponent,
} from 'react';

import { nanoid } from 'nanoid';

import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { t, styled } from '@superset-ui/core';

import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import Fieldset from './Fieldset';
import { recurseReactClone } from './utils';

interface CRUDCollectionProps {
  allowAddItem?: boolean;
  allowDeletes?: boolean;
  collection: Array<object>;
  columnLabels?: object;
  columnLabelTooltips?: object;
  emptyMessage?: ReactNode;
  expandFieldset?: ReactNode;
  extraButtons?: ReactNode;
  itemGenerator?: () => any;
  itemCellProps?: ((
    val: unknown,
    label: string,
    record: any,
  ) => DetailedHTMLProps<
    TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  >)[];
  itemRenderers?: ((
    val: unknown,
    onChange: () => void,
    label: string,
    record: any,
  ) => ReactNode)[];
  onChange?: (arg0: any) => void;
  tableColumns: Array<any>;
  sortColumns: Array<string>;
  stickyHeader?: boolean;
}

type Sort = number | string | boolean | any;

enum SortOrder {
  Asc = 1,
  Desc = 2,
  Unsorted = 0,
}

interface CRUDCollectionState {
  collection: object;
  collectionArray: Array<object>;
  expandedColumns: object;
  sortColumn: string;
  sort: SortOrder;
}

function createCollectionArray(collection: object) {
  return Object.keys(collection).map(k => collection[k]);
}

function createKeyedCollection(arr: Array<object>) {
  const collectionArray = arr.map((o: any) => ({
    ...o,
    id: o.id || nanoid(),
  }));

  const collection = {};
  collectionArray.forEach((o: any) => {
    collection[o.id] = o;
  });

  return {
    collection,
    collectionArray,
  };
}

const CrudTableWrapper = styled.div<{ stickyHeader?: boolean }>`
  ${({ stickyHeader }) =>
    stickyHeader &&
    `
      height: 350px;
      overflow-y: auto;
      overflow-x: auto;

      .table {
        min-width: 800px;
      }
      thead th {
        background: #fff;
        position: sticky;
        top: 0;
        z-index: 9;
        min
      }
    `}
  ${({ theme }) => `
    th span {
      vertical-align: ${theme.gridUnit * -2}px;
    }
    .text-right {
      text-align: right;
    }
    .empty-collection {
      padding: ${theme.gridUnit * 2 + 2}px;
    }
    .tiny-cell {
      width: ${theme.gridUnit + 1}px;
    }
    i.fa-caret-down,
    i.fa-caret-up {
      width: ${theme.gridUnit + 1}px;
    }
    td.expanded {
      border-top: 0;
      padding: 0;
    }
  `}
`;

const CrudButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.gridUnit * 2}px`}
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.gridUnit * 3}px;
    margin-left: ${theme.gridUnit * 3}px;
  `}
`;

export default class CRUDCollection extends PureComponent<
  CRUDCollectionProps,
  CRUDCollectionState
> {
  constructor(props: CRUDCollectionProps) {
    super(props);

    const { collection, collectionArray } = createKeyedCollection(
      props.collection,
    );
    this.state = {
      expandedColumns: {},
      collection,
      collectionArray,
      sortColumn: '',
      sort: 0,
    };
    this.renderItem = this.renderItem.bind(this);
    this.onAddItem = this.onAddItem.bind(this);
    this.renderExpandableSection = this.renderExpandableSection.bind(this);
    this.getLabel = this.getLabel.bind(this);
    this.onFieldsetChange = this.onFieldsetChange.bind(this);
    this.renderTableBody = this.renderTableBody.bind(this);
    this.changeCollection = this.changeCollection.bind(this);
    this.sortColumn = this.sortColumn.bind(this);
    this.renderSortIcon = this.renderSortIcon.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps: CRUDCollectionProps) {
    if (nextProps.collection !== this.props.collection) {
      const { collection, collectionArray } = createKeyedCollection(
        nextProps.collection,
      );
      this.setState({
        collection,
        collectionArray,
      });
    }
  }

  onCellChange(id: number, col: string, val: boolean) {
    this.changeCollection({
      ...this.state.collection,
      [id]: {
        ...this.state.collection[id],
        [col]: val,
      },
    });
  }

  onAddItem() {
    if (this.props.itemGenerator) {
      let newItem = this.props.itemGenerator();
      if (!newItem.id) {
        newItem = { ...newItem, id: nanoid() };
      }
      this.changeCollection(this.state.collection, newItem);
    }
  }

  onFieldsetChange(item: any) {
    this.changeCollection({
      ...this.state.collection,
      [item.id]: item,
    });
  }

  getLabel(col: any) {
    const { columnLabels } = this.props;
    let label = columnLabels?.[col] ? columnLabels[col] : col;
    if (label.startsWith('__')) {
      // special label-free columns (ie: caret for expand, delete cross)
      label = '';
    }
    return label;
  }

  getTooltip(col: string) {
    const { columnLabelTooltips } = this.props;
    return columnLabelTooltips?.[col];
  }

  changeCollection(collection: any, newItem?: object) {
    this.setState({ collection });
    if (this.props.onChange) {
      const collectionArray = this.state.collectionArray
        .map((c: { id: number }) => collection[c.id])
        // filter out removed items
        .filter(c => c !== undefined);

      if (newItem) {
        collectionArray.unshift(newItem);
      }
      this.props.onChange(collectionArray);
    }
  }

  deleteItem(id: number) {
    const newColl = { ...this.state.collection };
    delete newColl[id];
    this.changeCollection(newColl);
  }

  effectiveTableColumns() {
    const { tableColumns, allowDeletes, expandFieldset } = this.props;
    const cols = allowDeletes
      ? tableColumns.concat(['__actions'])
      : tableColumns;
    return expandFieldset ? ['__expand'].concat(cols) : cols;
  }

  toggleExpand(id: any) {
    this.onCellChange(id, '__expanded', false);
    this.setState(prevState => ({
      expandedColumns: {
        ...prevState.expandedColumns,
        [id]: !prevState.expandedColumns[id],
      },
    }));
  }

  sortColumn(col: string, sort = SortOrder.Unsorted) {
    const { sortColumns } = this.props;
    // default sort logic sorting string, boolean and number
    const compareSort = (m: Sort, n: Sort) => {
      if (typeof m === 'string') {
        return (m || ' ').localeCompare(n);
      }
      return m - n;
    };
    return () => {
      if (sortColumns?.includes(col)) {
        // display in unsorted order if no sort specified
        if (sort === SortOrder.Unsorted) {
          const { collection } = createKeyedCollection(this.props.collection);
          const collectionArray = createCollectionArray(collection);
          this.setState({
            collectionArray,
            sortColumn: '',
            sort,
          });
          return;
        }

        // newly ordered collection
        const sorted = [...this.state.collectionArray].sort(
          (a: object, b: object) => compareSort(a[col], b[col]),
        );
        const newCollection =
          sort === SortOrder.Asc ? sorted : sorted.reverse();

        this.setState(prevState => ({
          ...prevState,
          collectionArray: newCollection,
          sortColumn: col,
          sort,
        }));
      }
    };
  }

  renderSortIcon(col: string) {
    if (this.state.sortColumn === col && this.state.sort === SortOrder.Asc) {
      return <Icons.SortAsc onClick={this.sortColumn(col, 2)} />;
    }
    if (this.state.sortColumn === col && this.state.sort === SortOrder.Desc) {
      return <Icons.SortDesc onClick={this.sortColumn(col, 0)} />;
    }
    return <Icons.Sort onClick={this.sortColumn(col, 1)} />;
  }

  renderTH(col: string, sortColumns: Array<string>) {
    const tooltip = this.getTooltip(col);
    return (
      <th key={col} className="no-wrap">
        {this.getLabel(col)}
        {tooltip && (
          <>
            {' '}
            <InfoTooltipWithTrigger
              label={t('description')}
              tooltip={tooltip}
            />
          </>
        )}
        {sortColumns?.includes(col) && this.renderSortIcon(col)}
      </th>
    );
  }

  renderHeaderRow() {
    const cols = this.effectiveTableColumns();
    const { allowDeletes, expandFieldset, extraButtons, sortColumns } =
      this.props;
    return (
      <thead>
        <tr>
          {expandFieldset && <th aria-label="Expand" className="tiny-cell" />}
          {cols.map(col => this.renderTH(col, sortColumns))}
          {extraButtons}
          {allowDeletes && (
            <th key="delete-item" aria-label="Delete" className="tiny-cell" />
          )}
        </tr>
      </thead>
    );
  }

  renderExpandableSection(item: any) {
    const propsGenerator = () => ({ item, onChange: this.onFieldsetChange });
    return recurseReactClone(
      this.props.expandFieldset,
      Fieldset,
      propsGenerator,
    );
  }

  getCellProps(record: any, col: any) {
    const cellPropsFn = this.props.itemCellProps?.[col];
    const val = record[col];
    return cellPropsFn ? cellPropsFn(val, this.getLabel(col), record) : {};
  }

  renderCell(record: any, col: any) {
    const renderer = this.props.itemRenderers?.[col];
    const val = record[col];
    const onChange = this.onCellChange.bind(this, record.id, col);
    return renderer ? renderer(val, onChange, this.getLabel(col), record) : val;
  }

  renderItem(record: any) {
    const { allowAddItem, allowDeletes, expandFieldset, tableColumns } =
      this.props;
    /* eslint-disable no-underscore-dangle */
    const isExpanded =
      !!this.state.expandedColumns[record.id] || record.__expanded;
    let tds = [];
    if (expandFieldset) {
      tds.push(
        <td key="__expand" className="expand">
          <i
            role="button"
            aria-label="Toggle expand"
            tabIndex={0}
            className={`fa fa-caret-${
              isExpanded ? 'down' : 'right'
            } text-primary pointer`}
            onClick={this.toggleExpand.bind(this, record.id)}
          />
        </td>,
      );
    }
    tds = tds.concat(
      tableColumns.map(col => (
        <td {...this.getCellProps(record, col)} key={col}>
          {this.renderCell(record, col)}
        </td>
      )),
    );
    if (allowAddItem) {
      tds.push(<td key="add" />);
    }
    if (allowDeletes) {
      tds.push(
        <td
          key="__actions"
          data-test="crud-delete-option"
          className="text-primary"
        >
          <Icons.Trash
            aria-label="Delete item"
            className="pointer"
            data-test="crud-delete-icon"
            role="button"
            tabIndex={0}
            onClick={this.deleteItem.bind(this, record.id)}
          />
        </td>,
      );
    }
    const trs = [
      <tr {...{ 'data-test': 'table-row' }} className="row" key={record.id}>
        {tds}
      </tr>,
    ];
    if (isExpanded) {
      trs.push(
        <tr className="exp" key={`exp__${record.id}`}>
          <td
            colSpan={this.effectiveTableColumns().length}
            className="expanded"
          >
            <div>{this.renderExpandableSection(record)}</div>
          </td>
        </tr>,
      );
    }
    return trs;
  }

  renderEmptyCell() {
    return (
      <tr>
        <td className="empty-collection">{this.props.emptyMessage}</td>
      </tr>
    );
  }

  renderTableBody() {
    const data = this.state.collectionArray;
    const content = data.length
      ? data.map(d => this.renderItem(d))
      : this.renderEmptyCell();
    return <tbody data-test="table-content-rows">{content}</tbody>;
  }

  render() {
    return (
      <>
        <CrudButtonWrapper>
          {this.props.allowAddItem && (
            <StyledButtonWrapper>
              <Button
                buttonSize="small"
                buttonStyle="tertiary"
                onClick={this.onAddItem}
                data-test="add-item-button"
              >
                <i data-test="crud-add-table-item" className="fa fa-plus" />{' '}
                {t('Add item')}
              </Button>
            </StyledButtonWrapper>
          )}
        </CrudButtonWrapper>
        <CrudTableWrapper
          className="CRUD"
          stickyHeader={this.props.stickyHeader}
        >
          <table data-test="crud-table" className="table">
            {this.renderHeaderRow()}
            {this.renderTableBody()}
          </table>
        </CrudTableWrapper>
      </>
    );
  }
}
