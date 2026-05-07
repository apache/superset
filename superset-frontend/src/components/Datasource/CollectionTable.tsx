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
import { PureComponent, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { t, styled, css, SupersetTheme } from '@superset-ui/core';
import { Icons, Button, InfoTooltip } from '@superset-ui/core/components';
import { FilterValue } from 'react-table';
import Table, {
  type ColumnsType,
  type SortOrder,
  type SorterResult,
  type TablePaginationConfig,
  TableSize,
} from '@superset-ui/core/components/Table';
import Fieldset from './Fieldset';
import { recurseReactClone } from './utils';
import {
  type CRUDCollectionProps,
  type CRUDCollectionState,
  type Sort,
} from './types';

const CrudButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px`}
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
    margin-left: ${theme.sizeUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

type CollectionItem = { id: string | number; [key: string]: any };

function createKeyedCollection(arr: Array<object>) {
  const collectionArray = arr.map(
    (o: any) =>
      ({
        ...o,
        id: o.id || nanoid(),
      }) as CollectionItem,
  );

  const collection: Record<PropertyKey, any> = {};
  collectionArray.forEach((o: CollectionItem) => {
    collection[o.id] = o;
  });

  return {
    collection,
    collectionArray,
  };
}

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
    this.onAddItem = this.onAddItem.bind(this);
    this.renderExpandableSection = this.renderExpandableSection.bind(this);
    this.getLabel = this.getLabel.bind(this);
    this.onFieldsetChange = this.onFieldsetChange.bind(this);
    this.changeCollection = this.changeCollection.bind(this);
    this.handleTableChange = this.handleTableChange.bind(this);
    this.buildTableColumns = this.buildTableColumns.bind(this);
    this.toggleExpand = this.toggleExpand.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps: CRUDCollectionProps) {
    if (nextProps.collection !== this.props.collection) {
      const { collection, collectionArray } = createKeyedCollection(
        nextProps.collection,
      );

      this.setState(prevState => ({
        collection,
        collectionArray,
        expandedColumns: prevState.expandedColumns,
      }));
    }
  }

  onCellChange(id: number, col: string, val: boolean) {
    this.setState(prevState => {
      const updatedCollection = {
        ...prevState.collection,
        [id]: {
          ...prevState.collection[id],
          [col]: val,
        },
      };
      const updatedCollectionArray = prevState.collectionArray.map(item =>
        item.id === id ? updatedCollection[id] : item,
      );

      if (this.props.onChange) {
        this.props.onChange(updatedCollectionArray);
      }
      return {
        collection: updatedCollection,
        collectionArray: updatedCollectionArray,
      };
    });
  }

  onAddItem() {
    if (this.props.itemGenerator) {
      let newItem = this.props.itemGenerator();
      const shouldStartExpanded = newItem.expanded === true;
      if (!newItem.id) {
        newItem = { ...newItem, id: nanoid() };
      }
      delete newItem.expanded;

      this.setState(
        prevState => {
          const newCollection = {
            ...prevState.collection,
            [newItem.id]: newItem,
          };
          const newExpandedColumns = shouldStartExpanded
            ? { ...prevState.expandedColumns, [newItem.id]: true }
            : prevState.expandedColumns;
          const newCollectionArray = [newItem, ...prevState.collectionArray];

          return {
            collection: newCollection,
            collectionArray: newCollectionArray,
            expandedColumns: newExpandedColumns,
          };
        },
        () => {
          if (this.props.onChange) {
            this.props.onChange(this.state.collectionArray);
          }
        },
      );
    }
  }

  onFieldsetChange(item: any) {
    this.changeCollection({
      ...this.state.collection,
      [item.id]: item,
    });
  }

  getLabel(col: any): string {
    const { columnLabels } = this.props;
    let label = columnLabels?.[col] ? columnLabels[col] : col;
    if (label.startsWith('__')) {
      label = '';
    }
    return label;
  }

  getTooltip(col: string): string | undefined {
    const { columnLabelTooltips } = this.props;
    return columnLabelTooltips?.[col];
  }

  changeCollection(collection: any) {
    // Preserve existing order instead of recreating from Object.keys()
    const existingIds = new Set(
      this.state.collectionArray.map(item => item.id),
    );
    const newCollectionArray: CollectionItem[] = [];

    // First pass: preserve existing order and update items
    for (const existingItem of this.state.collectionArray) {
      if (collection[existingItem.id]) {
        newCollectionArray.push(collection[existingItem.id]);
      }
    }

    // Second pass: add new items
    for (const item of Object.values(collection) as CollectionItem[]) {
      if (!existingIds.has(item.id)) {
        newCollectionArray.push(item);
      }
    }

    this.setState({ collection, collectionArray: newCollectionArray });

    if (this.props.onChange) {
      this.props.onChange(newCollectionArray);
    }
  }

  deleteItem(id: string | number) {
    const newColl = { ...this.state.collection };
    delete newColl[id];
    this.changeCollection(newColl);
  }

  toggleExpand(id: any) {
    this.setState(prevState => ({
      expandedColumns: {
        ...prevState.expandedColumns,
        [id]: !prevState.expandedColumns[id],
      },
    }));
  }

  handleTableChange(
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<CollectionItem> | SorterResult<CollectionItem>[],
  ) {
    const columnSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    let newSortColumn = '';
    let newSortOrder = 0;

    if (columnSorter?.columnKey && columnSorter?.order) {
      newSortColumn = columnSorter.columnKey as string;
      newSortOrder = columnSorter.order === 'ascend' ? 1 : 2;
    }

    const { sortColumns } = this.props;
    const col = newSortColumn;

    if (sortColumns?.includes(col) || newSortOrder === 0) {
      let sortedArray = [...this.props.collection];

      if (newSortOrder !== 0) {
        const compareSort = (m: Sort, n: Sort) => {
          if (typeof m === 'string' && typeof n === 'string') {
            return (m || '').localeCompare(n || '');
          }
          if (typeof m === 'number' && typeof n === 'number') {
            return m - n;
          }
          if (typeof m === 'boolean' && typeof n === 'boolean') {
            return m === n ? 0 : m ? 1 : -1;
          }
          const mStr = String(m ?? '');
          const nStr = String(n ?? '');
          return mStr.localeCompare(nStr);
        };

        sortedArray.sort((a: any, b: any) => compareSort(a[col], b[col]));
        if (newSortOrder === 2) {
          sortedArray.reverse();
        }
      } else {
        const { collectionArray } = createKeyedCollection(
          this.props.collection,
        );
        sortedArray = collectionArray;
      }

      this.setState({
        collectionArray: sortedArray,
        sortColumn: newSortColumn,
        sort: newSortOrder,
      });
    }
  }

  renderExpandableSection(item: any): ReactNode {
    const propsGenerator = () => ({ item, onChange: this.onFieldsetChange });
    return recurseReactClone(
      this.props.expandFieldset,
      Fieldset,
      propsGenerator,
    );
  }

  renderCell(record: any, col: any): ReactNode {
    const renderer = this.props.itemRenderers?.[col];
    const val = record[col];
    const onChange = this.onCellChange.bind(this, record.id, col);
    return renderer ? renderer(val, onChange, this.getLabel(col), record) : val;
  }

  buildTableColumns() {
    const { tableColumns, allowDeletes, sortColumns = [] } = this.props;

    const antdColumns: ColumnsType = tableColumns.map(col => {
      const label = this.getLabel(col);
      const tooltip = this.getTooltip(col);
      const isSortable = sortColumns.includes(col);
      const currentSortOrder: SortOrder | null | undefined =
        this.state.sortColumn === col
          ? this.state.sort === 1
            ? 'ascend'
            : this.state.sort === 2
              ? 'descend'
              : null
          : null;

      return {
        key: col,
        dataIndex: col,
        minWidth: 100,
        title: (
          <>
            {label}
            {tooltip && (
              <>
                {' '}
                <InfoTooltip
                  label={t('description')}
                  tooltip={tooltip}
                  placement="top"
                />
              </>
            )}
          </>
        ),
        render: (text: any, record: CollectionItem) =>
          this.renderCell(record, col),
        onCell: (record: CollectionItem) => {
          const cellPropsFn = this.props.itemCellProps?.[col];
          const val = record[col];
          return cellPropsFn ? cellPropsFn(val, label, record) : {};
        },
        sorter: isSortable,
        sortOrder: currentSortOrder,
      };
    });

    if (allowDeletes) {
      antdColumns.push({
        key: '__actions',
        dataIndex: '__actions',
        sorter: false,
        title: <></>,
        onCell: () => ({}),
        sortOrder: null,
        minWidth: 50,
        render: (_, record: CollectionItem) => (
          <span
            data-test="crud-delete-option"
            className="text-primary"
            css={(theme: SupersetTheme) => css`
              display: flex;
              justify-content: center;
              color: ${theme.colorTextTertiary};
            `}
          >
            <Icons.DeleteOutlined
              aria-label="Delete item"
              className="pointer"
              data-test="crud-delete-icon"
              role="button"
              tabIndex={0}
              onClick={() => this.deleteItem(record.id)}
              iconSize="l"
              iconColor="inherit"
            />
          </span>
        ),
      });
    }

    return antdColumns as ColumnsType<CollectionItem>;
  }

  render() {
    const {
      stickyHeader,
      emptyMessage = t('No items'),
      expandFieldset,
    } = this.props;

    const tableColumns = this.buildTableColumns();
    const expandedRowKeys = Object.keys(this.state.expandedColumns).filter(
      id => this.state.expandedColumns[id],
    );

    const expandableConfig = expandFieldset
      ? {
          expandedRowRender: (record: CollectionItem) =>
            this.renderExpandableSection(record),
          rowExpandable: () => true,
          expandedRowKeys,
          onExpand: (expanded: boolean, record: CollectionItem) => {
            this.toggleExpand(record.id);
          },
        }
      : undefined;

    return (
      <>
        <CrudButtonWrapper>
          {this.props.allowAddItem && (
            <StyledButtonWrapper>
              <Button
                buttonSize="small"
                buttonStyle="secondary"
                onClick={this.onAddItem}
                data-test="add-item-button"
              >
                <Icons.PlusOutlined
                  iconSize="m"
                  data-test="crud-add-table-item"
                />
                {t('Add item')}
              </Button>
            </StyledButtonWrapper>
          )}
        </CrudButtonWrapper>
        <Table<CollectionItem>
          data-test="crud-table"
          columns={tableColumns}
          data={this.state.collectionArray as CollectionItem[]}
          rowKey={(record: CollectionItem) => String(record.id)}
          sticky={stickyHeader}
          pagination={false}
          onChange={this.handleTableChange}
          locale={{ emptyText: emptyMessage }}
          css={
            stickyHeader &&
            css`
              height: 350px;
              overflow: auto;
            `
          }
          expandable={expandableConfig}
          size={TableSize.Middle}
          tableLayout="auto"
        />
      </>
    );
  }
}
